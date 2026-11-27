# Scenario: an unwanted address appears as author in one commit and as co-author
# in another. A third person's commit must not change.

SUBSTITUTE=(
  "Your Name=New Name"
  "you@example.com=new@example.com"
)

setup() {
  commit a.txt "one: mine"
  GIT_AUTHOR_NAME="Old Bot" GIT_AUTHOR_EMAIL="old@example.com" commit b.txt "two: by the old address"
  commit c.txt "three: co-authored" "Co-authored-by: Old Bot <old@example.com>"
  GIT_AUTHOR_NAME="Colleague" GIT_AUTHOR_EMAIL="colleague@example.com" commit d.txt "four: colleague" \
    "Co-authored-by: Friend <friend@example.com>"
  git push -q origin main
  git branch -q --set-upstream-to=origin/main
}

verify() {
  # the commands that look for the address really find it
  grep -q "Old Bot <old@example.com>" <<< "$(output_of 2)" || fail "step 2 did not list the old address"
  grep -q "1 Old Bot <old@example.com>" <<< "$(output_of 3)" || fail "step 3 did not list the co-author"
  grep -q "two: by the old address" <<< "$(output_of 4)" || fail "step 4 missed the authored commit"
  grep -q "three: co-authored" <<< "$(output_of 4)" || fail "step 4 missed the co-authored commit"

  assert_eq "$(output_of 7 | tr -d ' ')" "0" "remaining mentions"
  assert_eq "$(git log --format='%ae %ce %B' main | grep -c old@example.com || true)" "0" "old address in history"

  # other people are untouched
  assert_eq "$(git log -1 --format='%an <%ae>')" "Colleague <colleague@example.com>" "colleague's commit"
  grep -q "Co-authored-by: Friend" <<< "$(git log -1 --format=%B)" || fail "another co-author was removed"
  assert_eq "$(git log --format=%s | tr '\n' ,)" "four: colleague,three: co-authored,two: by the old address,one: mine," "subjects"
  assert_eq "$(git --git-dir="$ORIGIN" rev-parse main)" "$(git rev-parse main)" "remote history"
}
