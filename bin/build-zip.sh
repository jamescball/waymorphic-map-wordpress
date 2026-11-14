#!/usr/bin/env bash
# Makes build/free-maps.zip: the plugin as WordPress installs it. Run from anywhere: bin/build-zip.sh
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
slug="free-maps"
cd "$root"

# The three version numbers must agree.
header="$(sed -n 's/^ \* Version: *//p' "$slug.php" | tr -d '[:space:]')"
constant="$(sed -n "s/^define( 'WAYMORPHIC_MAP_VERSION', '\(.*\)' );/\1/p" "$slug.php")"
stable="$(sed -n 's/^Stable tag: *//p' readme.txt | tr -d '[:space:]')"
if [ -z "$header" ] || [ "$header" != "$constant" ] || [ "$header" != "$stable" ]; then
	echo "Version mismatch: header '$header', constant '$constant', readme stable tag '$stable'." >&2
	exit 1
fi
# With a version as the argument (the release tag), it must agree too.
if [ "${1:-}" != "" ] && [ "${1#v}" != "$header" ]; then
	echo "Version mismatch: tag '${1}', plugin '$header'." >&2
	exit 1
fi

# The zip holds the committed files of HEAD, without the paths that
# .gitattributes marks export-ignore. Changes that are not committed are not in it.
mkdir -p "$root/build"
zip="$root/build/$slug.zip"
git archive --format=zip --prefix="$slug/" --output="$zip" HEAD
echo "Built $zip (version $header, commit $(git rev-parse --short HEAD))"
