# Scenario: edits, a new staged file, untracked files, an ignored file and an
# unpushed commit.

SUBSTITUTE=("path/to/file=app.txt")

setup() {
  echo ".env" > .gitignore && git add .gitignore
  commit app.txt   "one: app"
  commit other.txt "two: other"
  git push -q -u origin main
  commit local.txt "three: not pushed"
  echo SECRET=1 > .env
  echo edit >> app.txt
  echo edit >> other.txt
  echo new > staged.txt && git add staged.txt
  mkdir scratch && echo junk > scratch/junk.txt
}

verify() {
  local status
  status="$(output_of 1)"
  grep -q 'scratch/' <<< "$status" || fail "status did not list the untracked folder"
  grep -q 'Would remove scratch/' <<< "$(output_of 6)" || fail "dry run did not list scratch/: $(output_of 6)"

  assert_eq "$(git status --porcelain)" "" "clean"
  assert_eq "$(cat .env)" "SECRET=1" "ignored file was kept"
  assert_eq "$(git rev-parse HEAD)" "$(git rev-parse origin/main)" "matches the remote"
  assert_eq "$(git log -1 --format=%s backup-before-reset)" "three: not pushed" "backup"
  [ ! -e scratch ] || fail "scratch/ still there"
  [ ! -e staged.txt ] || fail "staged.txt still there"

  # stash and pop gives everything back
  echo edit >> app.txt && echo new > untracked.txt
  git stash push -q -u && assert_eq "$(git status --porcelain)" "" "stashed"
  git stash pop -q
  [ -e untracked.txt ] || fail "pop lost the new file"
}
