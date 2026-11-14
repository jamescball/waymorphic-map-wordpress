#!/usr/bin/env bash
# Makes build/free-maps.zip: the plugin as WordPress installs it. Run from anywhere: bin/build-zip.sh
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
slug="free-maps"
cd "$root"

# The zip holds the files of the last commit: the version numbers come from that
# commit, not from files with changes that are not committed.
git rev-parse --verify --quiet HEAD >/dev/null || { echo "This folder is not a git repository with a commit." >&2; exit 1; }
main="$(git show "HEAD:$slug.php")"
readme="$(git show HEAD:readme.txt)"

# The three version numbers must agree.
header="$(printf '%s\n' "$main" | sed -n 's/^ \* Version: *//p' | tr -d '[:space:]')"
constant="$(printf '%s\n' "$main" | sed -n "s/^define( 'WAYMORPHIC_MAP_VERSION', '\(.*\)' );/\1/p")"
stable="$(printf '%s\n' "$readme" | sed -n 's/^Stable tag: *//p' | tr -d '[:space:]')"
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
# A temporary name: a build that fails leaves no empty zip.
git archive --format=zip --prefix="$slug/" --output="$zip.tmp" HEAD
mv "$zip.tmp" "$zip"
echo "Built $zip (version $header, commit $(git rev-parse --short HEAD))"
if [ -n "$(git status --porcelain)" ]; then
	echo "Note: the working tree has changes that are not committed. They are not in the zip." >&2
fi
