const { Project, SyntaxKind } = require('ts-morph');

const project = new Project();
const sourceFile = project.addSourceFileAtPath('src/services/dataService.ts');

let replaced = true;
while (replaced) {
    replaced = false;
    const ifStatements = sourceFile.getDescendantsOfKind(SyntaxKind.IfStatement);
    for (const ifStmt of ifStatements) {
        const expr = ifStmt.getExpression().getText();
        if (expr.includes('isSupabaseConfigured')) {
            const thenStatement = ifStmt.getThenStatement();
            if (thenStatement.getKind() === SyntaxKind.Block) {
                const block = thenStatement;
                const statementsText = block.getStatements().map(s => s.getText()).join('\n');
                ifStmt.replaceWithText(`{\n${statementsText}\n}`);
                replaced = true;
                break; // Restart loop to avoid detached node errors
            }
        }
    }
}

const importDecls = sourceFile.getImportDeclarations();
for (const imp of importDecls) {
    if (imp.getModuleSpecifierValue() === './supabaseClient') {
        const namedImports = imp.getNamedImports();
        for (const named of namedImports) {
            if (named.getName() === 'isSupabaseConfigured') {
                named.remove();
            }
        }
    }
}

sourceFile.saveSync();
console.log('Successfully stripped mock logic from dataService.ts');
