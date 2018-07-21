// The module 'vscode' contains the VS Code extensibility API
const vscode = require('vscode');
// GPG command wrapper
const gpg = require('./gpg.js');

function activate(context) {

    // Encrypt command
    let encDisposable = vscode.commands.registerTextEditorCommand('extension.encrypt', function (textEditor) {

        let selection = textEditor.selection;
        let text = textEditor.document.getText(selection);

        gpg.listKeys().then(
            publicKeys => publicKeys.map(
                /** @param {gpg.PublicKey} currentValue */
                currentValue => ({
                    label: `<${currentValue.email}>`,
                    description: `(${currentValue.key_id})`,
                    detail: currentValue.name,
                    key_id: currentValue.key_id,
                    email: currentValue.email,
                })
            )
        ).then(
            options => vscode.window.showQuickPick(options, { placeHolder: "Select recipient" })
        ).then(
            /** @param {{email: string}} selected gpg key option */
            selected => gpg.encrypt(text, selected.email)
        ).then(encrypted => {

            textEditor.edit(edit => edit.replace(selection, encrypted));

            vscode.window.setStatusBarMessage('GPG Encrypted!', 2000);
        }).catch(err => console.error(err));
    });

    // Decrypt command
    let decDisposable = vscode.commands.registerTextEditorCommand('extension.decrypt', editor => {
        let selection = editor.selection;
        let text = editor.document.getText(selection);
        vscode.window.showInputBox({
            prompt: 'Provide your passphrase',
            placeHolder: 'My passphrase',
            password: true,
            validateInput: value => (value.length == 0) ? "Passphrase cannot be empty" : null
        }).then(
            passphrase => {
                if (passphrase === undefined || passphrase.length === 0) {
                    // Hitting Enter gets to here, which is not expected
                    vscode.window.setStatusBarMessage('No passphrase provided', 2000);
                    return Promise.reject("No passphrase provided")
                }
                return gpg.decrypt(text, passphrase)
            }
        ).then(
            decrypted => {
                editor.edit(editBuilder => editBuilder.replace(selection, decrypted));
                vscode.window.setStatusBarMessage('GPG Decrypted!', 2000);
            },
            error => { console.error("unable to decrypt text", error) }
        );
    });

    // register commands
    context.subscriptions.push(encDisposable);
    context.subscriptions.push(decDisposable);
}
exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {
}
exports.deactivate = deactivate;
