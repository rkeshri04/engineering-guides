# Scenario: .env, a build folder and a log file were all committed by mistake.
# A rule for the log file was added afterwards.

SUBSTITUTE=()

setup() {
  commit .env          "one: env"
  commit build/out.txt "two: build"
  commit debug.log     "three: log"
  printf 'node_modules/\n*.log' > .gitignore   # no trailing newline, on purpose
  git add .gitignore && git commit -q -m "four: ignore rules"
}

verify() {
  assert_eq "$(output_of 2)" ".env
debug.log" "tracked but ignored"
  assert_eq "$(output_of 6)" "debug.log" "still tracked and ignored"
  assert_eq "$(git ls-files)" ".gitignore" "only .gitignore is still tracked"
  [ -f .env ] && [ -f build/out.txt ] && [ -f debug.log ] || fail "a file was deleted from the folder"
  grep -qx '\*.log' .gitignore || fail "the existing ignore rule was damaged"
  assert_eq "$(git status --porcelain)" "" "clean"
}
