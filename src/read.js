const readline = require("readline-sync");

/**
 * Ask a question and get a console input response
 * @param q {string} question to ask
 * @param [defaultAnswer=""] {string} default answer (supplied in parenthesis)
 * @return {string} inputted answer or the default
 */
function ask(q, defaultAnswer = "") {
    let a;
    const question = defaultAnswer? `${q} (${defaultAnswer}): ` : `${q}: `;

    a = readline.question(question);

    if(a === "quit" || a === "exit")
        throw(new Error("quit"));

    return a? a : defaultAnswer;
}

module.exports = {
    ask
};