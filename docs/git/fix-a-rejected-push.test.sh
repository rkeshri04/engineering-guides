# Scenario: someone else pushed to main, so this clone's push is rejected.
# There is also an uncommitted edit.

SUBSTITUTE=()

setup() {
  commit a.txt "one: start"
  git push -q -u origin main

  git clone -q "$ORIGIN" ../other
  ( cd ../other && commit theirs.txt "two: theirs" && git push -q origin main )

  commit mine.txt "three: mine"
  echo unsaved >> a.txt

  if git push -q origin main 2> "$TEST_ROOT/state/push"; then fail "the push should be rejected"; fi
  grep -q 'rejected' "$TEST_ROOT/state/push" || fail "no [rejected] line"
  grep -q 'failed to push some refs' "$TEST_ROOT/state/push" || fail "different error: $(recall push)"
}

verify() {
  grep -q 'two: theirs' <<< "$(output_of 2)" || fail "their commit not listed"
  grep -q 'three: mine' <<< "$(output_of 3)" || fail "my commit not listed"
  assert_eq "$(git log --format=%s)" "three: mine
two: theirs
one: start" "history"
  assert_eq "$(git rev-parse HEAD)" "$(git --git-dir="$ORIGIN" rev-parse main)" "pushed"
  assert_eq "$(git status --porcelain)" " M a.txt" "uncommitted edit kept"
  assert_eq "$(git stash list)" "" "nothing left in the stash"
}
