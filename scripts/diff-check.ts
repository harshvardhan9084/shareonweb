// Temp QA harness for the /diff tool: runs the patience diff + unified diff
// (exported pure functions from diff-tool.tsx) over many cases and verifies
// each generated patch with real `git apply`, then checks the patched file
// matches the expected result byte for byte. Deleted before commit.
import { computeDiff, unifiedDiff, toLines } from '../src/components/instant/diff-tool'
import { execSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

let pass = 0
let fail = 0
const dir = mkdtempSync(join(tmpdir(), 'diffqa-'))

function check(name, A, B, opts = {}) {
  const res = computeDiff(A, B, { ignoreCase: false, ignoreTrail: false, ignoreBlank: false, ...opts })
  const LA = toLines(A); const LB = toLines(B)
  const patch = unifiedDiff(res.ops, LA.lines, LB.lines, LA.nl, LB.nl)
  if (patch === '') {
    // No patch is correct when the chosen options make the texts equal.
    if (res.stats.added === 0 && res.stats.removed === 0) pass++
    else {
      fail++
      console.log(`FAIL ${name}: texts differ but no patch was produced`)
    }
    return
  }
  writeFileSync(join(dir, 'original'), A) // the file being patched holds the original content
  writeFileSync(join(dir, 'p.patch'), patch + (patch.endsWith('\n') ? '' : '\n'))
  try {
    execSync('git apply -p1 p.patch', { cwd: dir, stdio: 'pipe' })
    const got = readFileSync(join(dir, 'original'), 'utf8')
    if (got === B) {
      pass++
    } else {
      fail++
      console.log(`FAIL ${name}: patch applies but result differs\n--- got ---\n${got}\n--- want ---\n${B}`)
    }
  } catch (e) {
    fail++
    console.log(`FAIL ${name}: git apply rejected patch\n${patch}\n${e.stderr}`)
  }
  execSync('rm -f original p.patch', { cwd: dir })
}

// 1. identical
check('identical', 'a\nb\nc\n', 'a\nb\nc\n')
// 2. empty -> text
check('empty-to-text', '', 'hello\nworld\n')
// 3. text -> empty
check('text-to-empty', 'hello\nworld\n', '')
// 4. single insertion middle
check('insert-middle', 'a\nb\nc\n', 'a\nb\nX\nc\n')
// 5. deletion
check('delete', 'a\nb\nc\nd\n', 'a\nd\n')
// 6. modification
check('modify', 'const a = 1\nconst b = 2\n', 'const a = 1\nconst b = 3\n')
// 7. multiple hunks
check('multi-hunk', '1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n', '1\n2x\n3\n4\n5\n6\n7\n8y\n9\n10\n')
// 8. insert at very start (hunk starts with +)
check('insert-first', 'a\nb\n', 'z\na\nb\n')
// 9. delete at very start (hunk starts with -)
check('delete-first', 'z\na\nb\n', 'a\nb\n')
// 10. pure insertion only (bPos placeholder check)
check('pure-insert', 'a\nb\nc\n', 'a\nb\nc\nd\ne\n')
// 11. pure deletion only
check('pure-delete', 'a\nb\nc\nd\ne\n', 'a\nb\nc\n')
// 12. no trailing newline both sides
check('no-trailing-newline', 'a\nb', 'a\nc')
// 13. big-ish text with scattered edits
{
  const A = Array.from({ length: 300 }, (_, i) => `line ${i} value ${i * 7}`).join('\n')
  const B = A.split('\n')
  B[10] = 'line 10 EDITED'
  B.splice(100, 0, 'INSERTED at 100')
  delete B[200]
  check('scattered-300', A, B.filter((l) => l !== undefined).join('\n'))
}
// 14. fully different (block replace)
check('fully-different', 'alpha\nbeta\ngamma\n', 'one\ntwo\nthree\nfour\n')
// 15. blank-heavy
check('blanks', 'a\n\n\nb\n', 'a\n\nb\n\n\nc\n')
// 16. repeated identical lines (patience anchors degenerate) with one change
check('repeated-lines', 'x\nx\nx\nx\nx\nx\nx\nx\nx\nx\n', 'x\nx\nx\nY\nx\nx\nx\nx\nx\nx\n')
// 17. ignore case option
check('ignore-case', 'Hello\nWorld\n', 'hello\nworld\n', { ignoreCase: true })
// 18. ignore blank option
check('ignore-blank', 'a\n\nb\n', 'a\nb\n', { ignoreBlank: true })
// 19. ignore whitespace
check('ignore-trail', 'a   \nb\n', 'a\nb\n', { ignoreTrail: true })
// 20. mixed tabs/spaces identical
check('tabs-and-spaces', 'a\tb\n c\n', 'a\tb\n c\n')
// 21. no trailing newline -> with trailing newline
check('nl-add', 'a\nb', 'a\nb\n')
// 22. with trailing newline -> no trailing newline
check('nl-remove', 'a\nb\n', 'a\nb')
// 23. both no trailing newline, content changed
check('no-nl-change', 'a\nb', 'a\nc')
// 24. single line no newline, edited
check('one-line-nonl', 'hello', 'hello world')

// ---- fuzz: 150 random edit cases, patches must apply and reconstruct ----
{
  let seed = 42
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648
    return seed / 2147483648
  }
  for (let t = 0; t < 150; t++) {
    const nA = Math.floor(rand() * 40) + 1
    const words = ['alpha', 'beta', 'gamma', 'x', 'hello world', 'foo=1;', '', 'end']
    const A = Array.from({ length: nA }, () => words[Math.floor(rand() * words.length)])
    const B = [...A]
    const edits = Math.floor(rand() * 8)
    for (let e = 0; e < edits; e++) {
      const kind = rand()
      const i = Math.floor(rand() * B.length)
      if (kind < 0.34) B.splice(i, 0, words[Math.floor(rand() * words.length)])
      else if (kind < 0.67) B.splice(i, 1)
      else B[i] = words[Math.floor(rand() * words.length)]
    }
    const nlA = rand() < 0.8
    const nlB = rand() < 0.8
    check(`fuzz-${t}`, A.join('\n') + (nlA && A.length ? '\n' : ''), B.join('\n') + (nlB && B.length ? '\n' : ''))
  }
  console.log('after fuzz:', pass, 'passed,', fail, 'failed')
}
rmSync(dir, { recursive: true, force: true })
process.exit(fail ? 1 : 0)
