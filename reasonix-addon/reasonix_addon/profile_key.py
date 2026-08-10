"""Privacy-preserving namespace key for an Anki profile collection."""

from __future__ import annotations

import os
from hashlib import sha256


def derive_profile_key(collection_path: str) -> str:
    """Hash the normalized collection path without exposing it over the API.

    The collection path is stable across normal Anki launches and distinct for
    copied profiles.  Renaming or moving a profile intentionally creates a new
    cache namespace, which is safer than accidentally reusing another
    collection's local Reasonix state.
    """

    if not isinstance(collection_path, str) or not collection_path:
        raise ValueError("collection_path must be a non-empty string")
    normalized = os.path.normcase(os.path.abspath(collection_path)).replace("\\", "/")
    digest = sha256(normalized.encode("utf-8")).hexdigest()
    return f"sha256:{digest}"

