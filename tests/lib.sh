# Helpers for guide test files. Sourced by the test runner; works with bash 3.2.
# Available: $WORKDIR (a git repo whose "origin" is the bare repo $ORIGIN).

fail() { echo "assertion failed: $*" >&2; exit 1; }

# setup() and verify() run in separate shells: pass values between them.
remember() { printf '%s' "$2" > "$TEST_ROOT/state/$1"; }
recall() { cat "$TEST_ROOT/state/$1"; }

assert_eq() { [ "$1" = "$2" ] || fail "${3:-values differ}: got '$1', expected '$2'"; }

# commit <path> <subject> [trailer line]...   (appends a line to <path>)
commit() {
  local file="$1" subject="$2" body="" line
  shift 2
  mkdir -p "$(dirname "$file")"
  echo "$subject" >> "$file"
  git add -- "$file"
  for line in "$@"; do body="$body$line
"; done
  if [ -n "$body" ]; then git commit -q -m "$subject" -m "$body"; else git commit -q -m "$subject"; fi
}

# Every commit in <range> has this author AND committer.
assert_identity() {
  local range="$1" want="$2 <$3>|$2 <$3>" got
  while IFS= read -r got; do
    assert_eq "$got" "$want" "author|committer in $range"
  done < <(git log --format='%an <%ae>|%cn <%ce>' "$range")
}

# No commit message in <range> has a line starting with any of the trailers.
assert_no_trailer() {
  local range="$1" messages name
  shift
  messages="$(git log --format=%B "$range")"
  for name in "$@"; do
    if grep -qi "^$name:" <<< "$messages"; then fail "$name trailer still in $range"; fi
  done
}

# None of the paths exists in the tree of any commit in <range>.
assert_files_absent() {
  local range="$1" sha path
  shift
  for sha in $(git rev-list "$range"); do
    for path in "$@"; do
      if git cat-file -e "$sha:$path" 2>/dev/null; then fail "$path still in commit $(git log -1 --format=%s "$sha")"; fi
    done
  done
}
