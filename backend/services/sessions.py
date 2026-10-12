import hashlib
import secrets
import time
from threading import Lock
from flask import current_app
from flask_jwt_extended import create_access_token, decode_token
from redis import Redis
from redis.exceptions import RedisError
from utils.security import auth_version


class SessionStoreUnavailable(RuntimeError):
    pass


class SessionStore:
    """Active-token allowlist: missing or evicted records never restore access."""

    def __init__(self, uri):
        self.redis = Redis.from_url(uri, socket_connect_timeout=3, socket_timeout=3) if uri.startswith(("redis://", "rediss://")) else None
        self.records = {}
        self.epochs = {}
        self.lock = Lock()

    @staticmethod
    def key(payload):
        jti = payload.get("jti")
        if not isinstance(jti, str) or not 1 <= len(jti) <= 128:
            return None
        return "paperloom:sessions:" + hashlib.sha256(jti.encode()).hexdigest()

    @staticmethod
    def epoch_key(identity):
        return "paperloom:session-epochs:" + hashlib.sha256(identity.encode()).hexdigest()

    def register(self, payload):
        key = self.key(payload)
        expiry = payload["exp"]
        identity = payload["sub"]
        ttl = int(expiry - time.time())
        if not key or ttl <= 0:
            raise ValueError("Cannot register an expired or invalid session.")
        if self.redis:
            try:
                epoch_key = self.epoch_key(identity)
                self.redis.set(epoch_key, secrets.token_hex(16), nx=True, ex=ttl)
                epoch = self.redis.get(epoch_key)
                if not isinstance(epoch, bytes) or len(epoch) != 32:
                    raise SessionStoreUnavailable()
                self.redis.expire(epoch_key, ttl, gt=True)
                if not self.redis.set(key, identity.encode() + b":" + epoch, ex=ttl):
                    raise SessionStoreUnavailable()
            except RedisError:
                raise SessionStoreUnavailable() from None
        else:
            with self.lock:
                self.records = {key: record for key, record in self.records.items() if record[1] > time.time()}
                epoch = self.epochs.setdefault(identity, secrets.token_hex(16))
                self.records[key] = (identity, expiry, epoch)

    def active(self, payload):
        key = self.key(payload)
        if not key:
            return False
        if self.redis:
            try:
                identity = str(payload.get("sub"))
                record, epoch = self.redis.mget([key, self.epoch_key(identity)])
                return isinstance(epoch, bytes) and record == identity.encode() + b":" + epoch
            except RedisError:
                raise SessionStoreUnavailable() from None
        with self.lock:
            record = self.records.get(key)
            return bool(record and record[0] == payload.get("sub") and record[1] > time.time()
                        and record[2] == self.epochs.get(record[0]))

    def revoke_user(self, identity):
        epoch = secrets.token_hex(16)
        if self.redis:
            try:
                if not self.redis.set(self.epoch_key(identity), epoch, ex=3600):
                    raise SessionStoreUnavailable()
            except RedisError:
                raise SessionStoreUnavailable() from None
        else:
            with self.lock:
                self.epochs[identity] = epoch

    def revoke(self, payload):
        key = self.key(payload)
        if not key:
            return
        if self.redis:
            try:
                self.redis.delete(key)
            except RedisError:
                raise SessionStoreUnavailable() from None
        else:
            with self.lock:
                self.records.pop(key, None)


def session_store():
    return current_app.extensions["paperloom_sessions"]


def issue_access_token(user):
    token = create_access_token(identity=str(user.id), additional_claims={"auth_version": auth_version(user)})
    session_store().register(decode_token(token))
    return token
