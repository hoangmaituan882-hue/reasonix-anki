"""Anki addon bootstrap for the Reasonix companion service."""

from aqt import gui_hooks, mw

from .reasonix_addon.entrypoint import install


runtime = install(mw, gui_hooks, addon_name=__name__)
