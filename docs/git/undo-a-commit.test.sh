# Scenario: one pushed commit, then one commit made too early.

SUBSTITUTE=()

setup() {
  echo base > notes.txt && git add notes.txt
  commit app.txt "one: start"
  git push -q -u origin main
  commit app.txt "two: too early"
  remember work "$(cat app.txt)"
  echo unfinished >> notes.txt   # not staged: must stay out of every commit
}

verify() {
  assert_eq "$(git log --format=%s)" 'Revert "A clearer message"
A clearer message
one: start' "history"
  assert_eq "$(git show HEAD~1:app.txt)" "$(recall work)" "the changes survived reset, amend and recovery"
  assert_eq "$(cat app.txt)" "one: start" "revert removed the changes"
  assert_eq "$(git show HEAD~1:notes.txt)" "base" "unfinished work was committed"
  grep -q 'HEAD@{1}: commit (amend): A clearer message' <<< "$(output_of 6)" || fail "HEAD@{1} is not the commit before the reset: $(output_of 6)"
  assert_eq "$(git rev-parse HEAD)" "$(git --git-dir="$ORIGIN" rev-parse main)" "revert was pushed"

  # amend --only leaves staged work out of the commit
  echo staged > extra.txt && git add extra.txt
  git commit -q --amend --only -m "message only"
  assert_eq "$(git diff --cached --name-only)" "extra.txt" "still staged"
}
