export function calculateExpression(input: string): number {
  const source = input.replace(/\s+/g, '')
  if (!source || source.length > 120 || !/^[\d.+\-*/()]+$/.test(source)) {
    throw new Error('Bitte einen gültigen mathematischen Ausdruck eingeben.')
  }

  let index = 0
  const parseExpression = (): number => {
    let value = parseTerm()
    while (source[index] === '+' || source[index] === '-') {
      const operator = source[index++]
      const right = parseTerm()
      value = operator === '+' ? value + right : value - right
    }
    return value
  }

  const parseTerm = (): number => {
    let value = parseFactor()
    while (source[index] === '*' || source[index] === '/') {
      const operator = source[index++]
      const right = parseFactor()
      if (operator === '/' && right === 0) throw new Error('Division durch null ist nicht möglich.')
      value = operator === '*' ? value * right : value / right
    }
    return value
  }

  const parseFactor = (): number => {
    const sign = source[index] === '-' ? (index += 1, -1) : source[index] === '+' ? (index += 1, 1) : 1
    if (source[index] === '(') {
      index += 1
      const value = parseExpression()
      if (source[index] !== ')') throw new Error('Klammer nicht geschlossen.')
      index += 1
      return sign * value
    }

    const start = index
    while (index < source.length && /[\d.]/.test(source[index])) index += 1
    if (start === index) throw new Error('Bitte einen gültigen mathematischen Ausdruck eingeben.')
    const value = Number(source.slice(start, index))
    if (!Number.isFinite(value)) throw new Error('Das Ergebnis ist nicht darstellbar.')
    return sign * value
  }

  const result = parseExpression()
  if (index !== source.length) throw new Error('Der Ausdruck enthält ungültige Zeichen oder Klammern.')
  if (!Number.isFinite(result)) throw new Error('Das Ergebnis ist nicht darstellbar.')
  return result
}
