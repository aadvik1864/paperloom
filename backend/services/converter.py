import os
import subprocess
import tempfile
import uuid
from io import BytesIO
from werkzeug.datastructures import FileStorage


class DocumentConverter:
    """
    Converts .docx files to PDF using headless LibreOffice.
    Falls back to a simple copy if LibreOffice is not available
    and the file is already a PDF.
    """

    SUPPORTED_EXTENSIONS = {".docx", ".doc", ".odt", ".rtf"}

    def convert_to_pdf(self, file_obj):
        ext = os.path.splitext(file_obj.filename)[1].lower()

        if ext == ".pdf":
            return file_obj

        if ext not in self.SUPPORTED_EXTENSIONS:
            raise ValueError(f"Unsupported file format: '{ext}'. Only PDF, DOCX, DOC, ODT, and RTF are supported.")

        tmp_dir = tempfile.mkdtemp()
        input_path = os.path.join(tmp_dir, f"input{ext}")
        output_path = os.path.join(tmp_dir, f"output.pdf")

        try:
            file_obj.seek(0)
            with open(input_path, "wb") as f:
                f.write(file_obj.read())

            result = subprocess.run(
                [
                    "libreoffice",
                    "--headless",
                    "--convert-to", "pdf",
                    "--outdir", tmp_dir,
                    input_path,
                ],
                capture_output=True,
                text=True,
                timeout=120,
            )

            if result.returncode != 0 or not os.path.exists(output_path):
                raise RuntimeError(f"LibreOffice conversion failed (exit {result.returncode}): {result.stderr or 'unknown error'}")

            with open(output_path, "rb") as f:
                pdf_data = f.read()

            pdf_filename = f"{uuid.uuid4().hex}.pdf"
            pdf_file = FileStorage(
                stream=BytesIO(pdf_data),
                filename=pdf_filename,
                content_type="application/pdf",
            )
            return pdf_file

        finally:
            for path in [input_path, output_path]:
                try:
                    if os.path.exists(path):
                        os.remove(path)
                except OSError:
                    pass
            try:
                os.rmdir(tmp_dir)
            except OSError:
                pass


converter = DocumentConverter()
