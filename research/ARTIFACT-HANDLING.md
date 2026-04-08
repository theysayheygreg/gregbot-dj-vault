# Artifact Handling

DJ Vault studies public vendor software, firmware, release notes, and support surfaces. That work needs discipline.

## Keep In Git

- manifests
- source maps
- extraction notes
- analysis docs
- small synthetic fixtures you created yourself

## Keep Out Of Git By Default

- vendor installers
- firmware zip files
- extracted proprietary binaries
- large caches
- temporary downloads

Use local storage such as `research/downloads/` or `research/tmp/` for those materials.

## Legal / Operational Boundary

- Use public artifacts and public documentation.
- Prefer static inspection over anything invasive.
- Do not bypass authentication or access controls.
- Do not commit proprietary binaries casually.

## Documentation Rule

Every important claim should still be reproducible from:

- a manifest
- a source URL
- a note in `research/analysis/`
- or a local artifact path outside git
