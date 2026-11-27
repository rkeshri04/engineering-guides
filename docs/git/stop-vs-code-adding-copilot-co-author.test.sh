# Scenario: three pushed commits carry the Copilot line; one also has a human
# co-author, which must stay.

SUBSTITUTE=("HEAD~N..HEAD=HEAD~3..HEAD")

COPILOT="Co-authored-by: Copilot <copilot@github.com>"
HUMAN="Co-authored-by: Friend <friend@example.com>"

setup() {
  commit a.txt "one: start"
  commit b.txt "two: with copilot" "$COPILOT"
  commit c.txt "three: pair work" "$HUMAN" "$COPILOT"
  commit d.txt "four: latest" "$COPILOT"
  git push -q origin main
}

verify() {
  local found
  found="$(output_of 2)"
  for subject in "two: with copilot" "three: pair work" "four: latest"; do
    grep -q "$subject" <<< "$found" || fail "step 1 missed: $subject"
  done

  assert_no_trailer_text() { if git log --format=%B "$1" | grep -qi '^co-authored-by: copilot'; then fail "Copilot line still in $1"; fi; }
  assert_no_trailer_text HEAD
  grep -q "$HUMAN" <<< "$(git log --format=%B)" || fail "the human co-author was removed"
  assert_eq "$(git log --format=%s | tr '\n' ,)" "four: latest,three: pair work,two: with copilot,one: start," "subjects"
  assert_eq "$(git --git-dir="$ORIGIN" rev-parse main)" "$(git rev-parse main)" "remote history"

  # the hook strips the line from a new commit and keeps the rest
  commit e.txt "five: after the hook" "$HUMAN" "$COPILOT"
  assert_no_trailer_text HEAD
  grep -q "$HUMAN" <<< "$(git log -1 --format=%B)" || fail "the hook removed the human co-author"

  # a message without the line passes through
  commit f.txt "six: plain"
  assert_eq "$(git log -1 --format=%s)" "six: plain" "plain commit with the hook"
}
