// Safe arithmetic expression evaluator for table formula columns.
// Supports: +  -  *  /  %  ()  number literals  [Column Label] references
// No eval(), no Function(), no external dependencies.

function tokenize(expr) {
  const tokens = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if ("+-*/()%".includes(ch)) { tokens.push(ch); i++; }
    else if (/[0-9.]/.test(ch)) {
      let num = "";
      while (i < expr.length && /[0-9.]/.test(expr[i])) num += expr[i++];
      tokens.push({ type: "num", value: Number(num) });
    } else {
      i++; // skip unknown chars (spaces already stripped)
    }
  }
  return tokens;
}

function evaluate(tokens) {
  let pos = 0;

  const peek = () => tokens[pos];
  const consume = () => tokens[pos++];

  const parseExpr = () => {
    let left = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const op = consume();
      const right = parseTerm();
      left = op === "+" ? left + right : left - right;
    }
    return left;
  };

  const parseTerm = () => {
    let left = parseFactor();
    while (peek() === "*" || peek() === "/" || peek() === "%") {
      const op = consume();
      const right = parseFactor();
      if (op === "*") left = left * right;
      else if (op === "/") left = right !== 0 ? left / right : NaN;
      else left = right !== 0 ? left % right : NaN;
    }
    return left;
  };

  const parseFactor = () => {
    const t = peek();
    if (t === "-") { consume(); return -parseFactor(); }
    if (t === "+") { consume(); return parseFactor(); }
    if (t === "(") {
      consume();
      const val = parseExpr();
      if (peek() === ")") consume();
      return val;
    }
    if (t && typeof t === "object" && t.type === "num") {
      consume();
      return t.value;
    }
    consume(); // skip unexpected token
    return 0;
  };

  const result = parseExpr();
  if (!isFinite(result)) return NaN;
  return Math.round(result * 1e10) / 1e10;
}

// Resolve [Column Label] references in a formula string, then evaluate.
// columns: array of { id, label, type }
// row: { [colId]: value }
export function evaluateFormula(formula, row, columns) {
  if (!formula || typeof formula !== "string") return "";
  const expr = formula.replace(/\[([^\]]+)\]/g, (_, label) => {
    const col = columns.find(c => c.label === label);
    if (!col) return "0";
    const val = row[col.id];
    if (col.type === "checkbox") return (val === true || val === "true") ? "1" : "0";
    const n = Number(val);
    return isNaN(n) ? "0" : String(n);
  });
  const stripped = expr.replace(/\s+/g, "");
  try {
    const tokens = tokenize(stripped);
    const result = evaluate(tokens);
    return isNaN(result) ? "ERR" : result;
  } catch {
    return "ERR";
  }
}

// Return a human-readable description of the formula syntax for the UI.
export const FORMULA_HELP = "Use [Column Label] to reference other columns. Supports + - * / % and parentheses. Example: [Price] * [Qty]";
