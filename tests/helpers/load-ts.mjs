import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

export function loadTs(path, dependencies = {}, env = {}) {
  const exports = {}
  const source = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  vm.runInNewContext(source, {
    exports, process: { env }, Response,
    require(name) {
      if (!(name in dependencies)) throw new Error(`Unexpected import: ${name}`)
      return dependencies[name]
    },
  })
  return exports
}
