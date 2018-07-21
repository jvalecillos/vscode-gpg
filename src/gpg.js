/**
 * @file Wrapper for gpg encrypting using promises
 * @author Jose Valecillos
 */
const gpg = require('gpg');
const tmp = require('tmp');
const fs = require('fs')

/**
 * Returns a list of public keys available for encryption
 *
 * @returns {Promise<Array<PublicKey>>} returns a promise for a encrypted string
 */
function listKeys() {

    // List options
    var args = [
        '--list-keys',
        '--fixed-list-mode',
        '--fingerprint',
        '--with-colons'
    ];

    return new Promise(function (resolve, reject) {
        gpg.call('', args, function (err, result) {
            if (err) {
                reject(err);
            } else {
                resolve(parseKeys(result.toString()));
            }
        });
    });
}

/**
  @typedef {object} PublicKey
  @property {string} key_id Key short id
  @property {string} fingerprint Key fingerprint
  @property {string} email Key ownner email
  @property {string} name Key ownner name
  @property {number} creation_date Creation date timestamp
  @property {number} expiration_date Expiration date timestamp
  @property {boolean} encrypt Encryption capability
  @property {boolean} sign Signing capability
 */

/**
 * Parses the output of `gpg --list-keys --fixed-list-mode --fingerprint --with-colons`
 * 
 * http://git.gnupg.org/cgi-bin/gitweb.cgi?p=gnupg.git;a=blob_plain;f=doc/DETAILS
 *
 * @param {string} stdout
 * @returns {Array<PublicKey>} array of public keys
 */
function parseKeys(stdout) {

    let nameEmailRegex = /(.+)\s+<(.+)>/;

    let lines = stdout.trim().split(/\s*[\r\n]+\s*/g);

    let result = {};
    let currentKey = '';

    for (var i = 0; i < lines.length; i++) {

        let currentLine = lines[i].trim();

        if (currentLine.length <= 0) {
            continue;
        }

        let parts = currentLine.split(':');

        switch (parts[0]) {
            case 'pub':
                currentKey = parts[4];
                let encrypt_cap = (parts[11].match(/e/i) !== null)
                let sign_cap = (parts[11].match(/e/i) !== null)
                result[currentKey] = {
                    key_id: currentKey,
                    cretion_date: parts[5],
                    expiration_date: parts[6],
                    encrypt: encrypt_cap,
                    sign: sign_cap,
                };
                break;
            case 'fpr':
                // parts[9] fingerprint
                if (currentKey && parts[9].includes(currentKey)) {
                    result[currentKey].fingerprint = parts[9];
                }
                break;
            case 'uid':
                // parts[5] uid
                // parts[9] name [(description)] <email>
                let matches = nameEmailRegex.exec(parts[9]);
                if (matches && matches.length >= 3) {
                    result[currentKey].name = matches[1];
                    result[currentKey].email = matches[2];
                }
                break;
            case 'sub':
                // Subkeys could be process here
                break;
            default:
                continue;
        }
    }

    // Flatten object to array of objects
    // More verbose than Object.keys(result).map(k => result[k]); yet more efficient
    let output = [];
    for(let k in result) {
        if (result.hasOwnProperty(k)) {
            output.push(result[k]);
        }
    }

    return output;
}

/**
 * Encrypt a text for the given recipient (email address)
 *
 * @param {string} text
 * @param {string} recipientID
 * @returns {Promise<String>} returns a promise for a encrypted string
 */
function encrypt(text, recipientID) {

    let args = [
        '--trust-model', 'always',
        '--recipient', recipientID,
        '--armor',
        '--trust-model', 'always' // so we don't get "no assurance this key belongs to the given user"
    ];

    return new Promise(function (resolve, reject) {

        gpg.encrypt(text, args, function (err, result) {
            if (err) {
                reject(err);
            } else {
                resolve(result.toString());
            }
        });

    });
}

/**
 * Decrypt a text given the passphrase
 *
 * @param {string} text
 * @param {string} passphrase
 * @returns {Promise<String>} returns a promise for a decrypted string
 */
function decrypt(text, passphrase) {

    return new Promise(function (resolve, reject) {
        // @ts-ignore
        tmp.file(function _tempFileCreated(err, filePath, fd, cleanupCallback) {
            if (err) reject(err);

            // Decrytion parametersa
            let args = [
                '--batch',
                '--passphrase-fd', '0', // Passing passphrase in stdin
                '--armor',
                '--pinentry-mode', 'loopback',
                '--no-tty',
                '--quiet',
                '--decrypt',
                filePath
            ];

            fs.appendFile(filePath, text, function (err) {
                if (err) {
                    reject(err);
                } else {
                    // Decrypt call
                    gpg.call(passphrase, args, function (err, result) {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(result.toString());
                        }
                    });
                }
            });
        });
    });
}

// export the module
module.exports = {
    listKeys: listKeys,
    encrypt: encrypt,
    decrypt: decrypt
};
