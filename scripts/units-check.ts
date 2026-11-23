// Temp QA harness for /convert-units: exact factors, temperature formulas,
// base parsing/printing via BigInt, Roman rules. Deleted before commit.
import { parseInBase, bigToBase, intToRoman, romanToInt, fmtNumber, tempToCelsius, tempFromCelsius } from '../src/components/instant/convert-units-tool'

let pass = 0
let fail = 0
function ok(name: string, cond: boolean, detail = '') {
  if (cond) pass++
  else {
    fail++
    console.log(`FAIL ${name} ${detail}`)
  }
}

// bases
ok('hex parse', parseInBase('ff', 16) === 255n)
ok('bin parse', parseInBase('1010', 2) === 10n)
ok('hex prefix', parseInBase('0xff', 16) === 255n)
ok('bin prefix', parseInBase('0b101', 2) === 5n)
ok('base36 parse', parseInBase('zz', 36) === 1295n)
ok('big int 64-bit', parseInBase('18446744073709551615', 10) === 2n ** 64n - 1n)
ok('invalid char rejected', parseInBase('ffg', 16) === null)
ok('digit beyond base rejected', parseInBase('129', 8) === null)
ok('negative parse', parseInBase('-ff', 16) === -255n)
ok('grouped separators', parseInBase('2026', 10) === 2026n && parseInBase('20 26', 10) === 2026n)
ok('to base 36', bigToBase(1295n, 36) === 'zz')
ok('to binary', bigToBase(10n, 2) === '1010')
ok('round trip 36', bigToBase(parseInBase('hello.world'.replace('.', ''), 36)!, 36) === 'helloworld')

// roman
ok('2026 -> MMXXVI', intToRoman(2026) === 'MMXXVI')
ok('3999 -> MMMCMXCIX', intToRoman(3999) === 'MMMCMXCIX')
ok('0 rejected', intToRoman(0) === null)
ok('4000 rejected', intToRoman(4000) === null)
ok('MMXXVI -> 2026', romanToInt('MMXXVI').ok && (romanToInt('MMXXVI') as { value: number }).value === 2026)
ok('MCMXCIV -> 1994', (romanToInt('MCMXCIV') as { value: number }).value === 1994)
ok('IIIVX rejected', !romanToInt('IIIVX').ok)
ok('IC rejected', !romanToInt('IC').ok && (romanToInt('IC') as { reason: string }).reason.includes('subtractive'))
ok('VV rejected', !romanToInt('VV').ok && (romanToInt('VV') as { reason: string }).reason.includes('repeat'))
ok('IIII rejected', !romanToInt('IIII').ok)
ok('lowercase accepted', (romanToInt('mmxxvi') as { value: number }).value === 2026)
ok('XM rejected', !romanToInt('XM').ok)

// temperature
ok('f->c', tempToCelsius(32, 'f') === 0)
ok('c->f', tempFromCelsius(100, 'f') === 212)
ok('k->c', tempToCelsius(0, 'k') === -273.15)
ok('c->k', tempFromCelsius(37, 'k') === 310.15)
ok('f->k', Math.abs(tempFromCelsius(tempToCelsius(212, 'f'), 'k') - 373.15) < 1e-9)

// number formatting
ok('trim zeros', fmtNumber(1.609344) === '1.609344')
ok('mile factor', fmtNumber(1609.344) === '1609.344')
ok('small number', fmtNumber(0.00064516) === '0.00064516')
ok('big grouped fallback', fmtNumber(1234567890123456789) === '1.234568e+18' || fmtNumber(1234567890123456789).includes('e+18'))

// exactness of the published factors used in the tables
ok('inch exact', Math.abs(0.0254 * 3 - 0.0762) < 1e-15)
ok('pound exact', 0.45359237 * 2 === 0.90718474)
ok('mile exact', 1609.344 === 5280 * 0.3048)

console.log(`${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
