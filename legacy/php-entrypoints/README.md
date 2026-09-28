# Retired PHP entry points

These are source references from before the static-host migration. They are not
served, copied into the frontend image, or runnable from this location. The live
frontend uses `docker/Caddyfile`; all backend requests go to `~/platform`.

Remaining domain PHP in `app/` is retained until its workflows have tested platform
replacements. Keeping a source reference does not mean its feature is ported.
