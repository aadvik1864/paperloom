import os
import re
import shutil
import signal
import subprocess
import tempfile
import warnings
import zipfile
from functools import lru_cache
from io import BytesIO
from pathlib import Path
from urllib.parse import urlsplit
from defusedxml.ElementTree import fromstring
from flask import current_app
from olefile import OleFileIO
from PIL import Image, UnidentifiedImageError
from pypdf import PdfReader
from pypdf.generic import ArrayObject, DictionaryObject, IndirectObject
from werkzeug.datastructures import FileStorage


def read_upload(file_obj, limit):
    file_obj.seek(0)
    data = file_obj.read(limit + 1)
    if not data or len(data) > limit:
        raise ValueError(f"Upload a non-empty file smaller than {limit // (1024 * 1024)} MB.")
    return data


def validate_pdf(data):
    if not data.startswith(b"%PDF-"):
        raise ValueError("The file is not a valid PDF.")
    try:
        reader = PdfReader(BytesIO(data), strict=True)
        if reader.is_encrypted or not 1 <= len(reader.pages) <= 500:
            raise ValueError("Use an unencrypted PDF with 1–500 pages.")
        pending = [reader.trailer]
        visited = set()
        count = 0
        forbidden = {"/JS", "/JavaScript", "/AA", "/OpenAction", "/EmbeddedFiles", "/RichMedia", "/XFA",
                     "/SubmitForm", "/ImportData", "/Launch", "/GoToR", "/GoToE", "/EmbeddedFile"}
        while pending:
            count += 1
            if count > 30000:
                raise ValueError("This PDF is too complex to process safely.")
            item = pending.pop()
            if isinstance(item, IndirectObject):
                key = (item.idnum, item.generation)
                if key in visited:
                    continue
                visited.add(key)
                item = item.get_object()
            if isinstance(item, DictionaryObject):
                if forbidden.intersection(item) or item.get("/S") in {"/JavaScript", "/Launch", "/GoToR", "/GoToE"}:
                    raise ValueError("PDFs with scripts, automatic actions, or embedded files are not accepted.")
                if item.get("/Type") in {"/Filespec", "/EmbeddedFile", "/RichMedia"}:
                    raise ValueError("PDFs with scripts, automatic actions, or embedded files are not accepted.")
                pending.extend(item.values())
            elif isinstance(item, ArrayObject):
                pending.extend(item)
    except ValueError:
        raise
    except Exception as error:
        raise ValueError("The PDF is damaged or cannot be safely read.") from error


def validate_office(data, extension):
    if extension in {".docx", ".odt"}:
        try:
            with zipfile.ZipFile(BytesIO(data)) as archive:
                files = archive.infolist()
                names = {item.filename for item in files}
                required = {"[Content_Types].xml", "word/document.xml"} if extension == ".docx" else {"mimetype", "content.xml"}
                if not required.issubset(names) or len(files) > 2000 or sum(item.file_size for item in files) > 100 * 1024 * 1024:
                    raise ValueError("Invalid or excessively large Office document.")
                if extension == ".odt" and archive.read("mimetype") != b"application/vnd.oasis.opendocument.text":
                    raise ValueError("The file is not a text document.")
                for item in files:
                    name = item.filename.lower()
                    if item.flag_bits & 1 or name.startswith("/") or ".." in Path(name).parts:
                        raise ValueError("Encrypted or unsafe Office archives are not accepted.")
                    if any(part in name for part in ("vbaproject", "activex/", "embeddings/", "scripts/", "objectpool/")):
                        raise ValueError("Remove macros and embedded objects before uploading.")
                    if name.endswith((".xml", ".rels")):
                        if item.file_size > 8 * 1024 * 1024:
                            raise ValueError("Office XML exceeds the safe processing limit.")
                        root = fromstring(archive.read(item))
                        for node in root.iter():
                            target = node.attrib.get("Target", "")
                            if node.attrib.get("TargetMode") == "External":
                                if not node.attrib.get("Type", "").endswith("/hyperlink") or urlsplit(target).scheme not in {"http", "https"}:
                                    raise ValueError("External document resources are not accepted.")
                            href = node.attrib.get("{http://www.w3.org/1999/xlink}href", "")
                            if href and not href.startswith(("#", "Pictures/")) and urlsplit(href).scheme:
                                if not node.tag.endswith("}a") or urlsplit(href).scheme not in {"http", "https"}:
                                    raise ValueError("External document resources are not accepted.")
        except ValueError:
            raise
        except Exception as error:
            raise ValueError("The Office document is damaged or has unsafe XML.") from error
    elif extension == ".doc":
        try:
            with OleFileIO(BytesIO(data)) as document:
                if not document.exists("WordDocument"):
                    raise ValueError("The file is not a Word document.")
                for parts in document.listdir():
                    if any(part.lower() in {"vba", "macros", "objectpool"} for part in parts):
                        raise ValueError("Remove macros and embedded objects before uploading.")
        except ValueError:
            raise
        except Exception as error:
            raise ValueError("The file is not a valid Word document.") from error
    elif extension == ".rtf" and not data.lstrip().startswith(b"{\\rtf"):
        raise ValueError("The file is not a valid RTF document.")
    if extension in {".doc", ".rtf"}:
        text = data.decode("latin1", errors="ignore") + data.decode("utf-16le", errors="ignore")
        if re.search(r"\b(?:DDE|DDEAUTO|INCLUDETEXT|INCLUDEPICTURE)\b|\\(?:object|objdata)\b", text, re.I):
            raise ValueError("Remove active fields and embedded objects before uploading.")


def validate_avatar(file_obj):
    data = read_upload(file_obj, current_app.config["MAX_AVATAR_BYTES"])
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(data)) as image:
                if image.format not in {"JPEG", "PNG", "WEBP"} or image.width * image.height > 25000000:
                    raise ValueError("Use a JPEG, PNG, or WebP image smaller than 25 megapixels.")
                image.verify()
            with Image.open(BytesIO(data)) as image:
                image.thumbnail((1024, 1024))
                output = BytesIO()
                image.convert("RGB").save(output, format="JPEG", quality=85)
        output.seek(0)
        return FileStorage(stream=output, filename="avatar.jpg", content_type="image/jpeg")
    except ValueError:
        raise
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, Image.DecompressionBombWarning) as error:
        raise ValueError("Upload a valid JPEG, PNG, or WebP image.") from error


class DocumentConverter:
    SUPPORTED_EXTENSIONS = {".docx", ".doc", ".odt", ".rtf"}

    @staticmethod
    @lru_cache(maxsize=1)
    def available():
        if not all(shutil.which(tool) for tool in ("libreoffice", "prlimit", "bwrap")):
            return False
        command = ["bwrap", "--unshare-all", "--die-with-parent", "--new-session", "--clearenv",
                   "--ro-bind", "/usr", "/usr", "--symlink", "usr/lib", "/lib"]
        if Path("/lib64").exists():
            command.extend(["--ro-bind", "/lib64", "/lib64"])
        command.extend(["--", "/usr/bin/true"])
        try:
            return subprocess.run(command, env={"PATH": "/usr/bin:/bin"}, stdout=subprocess.DEVNULL,
                                  stderr=subprocess.DEVNULL, timeout=5, check=False).returncode == 0
        except (OSError, subprocess.TimeoutExpired):
            return False

    def convert_to_pdf(self, file_obj):
        extension = Path(file_obj.filename or "").suffix.lower()
        if extension not in self.SUPPORTED_EXTENSIONS | {".pdf"}:
            raise ValueError("Upload a PDF, DOCX, DOC, ODT, or RTF document.")
        limit = current_app.config["MAX_FILE_BYTES"]
        data = read_upload(file_obj, limit)
        if extension == ".pdf":
            validate_pdf(data)
        else:
            validate_office(data, extension)
            if not self.available():
                raise RuntimeError("Document conversion is unavailable. Upload a PDF instead.")
            with tempfile.TemporaryDirectory(prefix="paperloom-") as directory:
                root = Path(directory)
                source = root / f"input{extension}"
                source.write_bytes(data)
                output = root / "output"
                output.mkdir()
                profile = root / "profile"
                profile.mkdir()
                # Disable macros and document update/link prompts in an isolated profile.
                (profile / "user").mkdir()
                (profile / "user/registrymodifications.xcu").write_text(
                    '<?xml version="1.0"?><oor:items xmlns:oor="http://openoffice.org/2001/registry">'
                    '<item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="MacroSecurityLevel" oor:op="fuse"><value>3</value></prop></item>'
                    '<item oor:path="/org.openoffice.Office.Writer/Content/Update"><prop oor:name="Link" oor:op="fuse"><value>2</value></prop></item></oor:items>'
                )
                # Fail closed if the host does not permit bubblewrap namespaces.
                # The converter sees no app files/credentials and has no network.
                command = ["prlimit", "--as=1073741824", "--cpu=30", f"--fsize={limit}", "--nofile=256", "--",
                           "bwrap", "--unshare-all", "--die-with-parent", "--new-session", "--clearenv",
                           "--ro-bind", "/usr", "/usr", "--symlink", "usr/bin", "/bin", "--symlink", "usr/lib", "/lib"]
                if Path("/lib64").exists():
                    command.extend(["--ro-bind", "/lib64", "/lib64"])
                for config_dir in ("/etc/fonts", "/etc/libreoffice"):
                    if Path(config_dir).exists():
                        command.extend(["--ro-bind", config_dir, config_dir])
                command.extend(["--proc", "/proc", "--dev", "/dev", "--tmpfs", "/tmp", "--bind", directory, "/work",
                                "--chdir", "/work", "--setenv", "HOME", "/work", "--setenv", "PATH", "/usr/bin:/bin",
                                "--setenv", "LANG", "C.UTF-8", "libreoffice", "-env:UserInstallation=file:///work/profile",
                                "--headless", "--nologo", "--nodefault", "--norestore", "--convert-to", "pdf:writer_pdf_Export",
                                "--outdir", "/work/output", f"/work/input{extension}"])
                process = subprocess.Popen(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
                try:
                    process.communicate(timeout=45)
                except subprocess.TimeoutExpired as error:
                    os.killpg(process.pid, signal.SIGKILL)
                    process.communicate()
                    raise ValueError("Conversion timed out. Export your document to PDF and try again.") from error
                results = list(output.glob("*.pdf"))
                if process.returncode or len(results) != 1:
                    raise ValueError("The document could not be safely converted. Upload a PDF instead.")
                if results[0].stat().st_size > limit:
                    raise ValueError("The converted PDF exceeds the 20 MB limit.")
                data = results[0].read_bytes()
                validate_pdf(data)
        return FileStorage(stream=BytesIO(data), filename="paper.pdf", content_type="application/pdf")


converter = DocumentConverter()
