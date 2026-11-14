#!/usr/bin/env bash
# Prints the changelog entry of one version from readme.txt, as the notes
# of a GitHub release: bin/release-notes.sh v1.0.0
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
version="${1#v}"

notes="$(awk -v version="$version" '
	/^== Changelog ==/ { changelog = 1; next }
	changelog && /^== / { exit }
	changelog && /^= / { entry = ( $0 == "= " version " =" ); next }
	changelog && entry { print }
' "$root/readme.txt" | sed -e '/./,$!d')"

if [ -z "$notes" ]; then
	echo "No changelog entry for version $version in readme.txt." >&2
	exit 1
fi
printf '%s\n' "$notes"
