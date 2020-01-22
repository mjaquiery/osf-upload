require('dotenv').config();
const chalk = require("chalk");
const read = require("./src/read.js");
const osf = require("./src/osf.js");

let vars = {
    dir: "https://acclab.psy.ox.ac.uk/~mj221/ESM/data/public/",
    study: "coolStudy",
    version: "M-m-r",
    osf: "",
    ok: "no|yes"
};

function getInputs(vars) {
    vars.dir = read.ask("Data file directory", vars.dir);

    vars.study = read.ask("Study name", vars.study);

    vars.version = read.ask("Study version", vars.version);

    vars.osf = read.ask("OSF repository id", vars.osf);

    return vars;
}

(async () => {
    try {
        while(true) {
            try {
                vars = getInputs(vars);

                if(await osf.showDetails(
                    vars.dir,
                    vars.study,
                    vars.version,
                    vars.osf
                )) {
                    if(read.ask("Write files?", vars.ok)
                        .toLowerCase()[0] === "y") {
                        if(await osf.uploadFiles(
                            vars.dir,
                            vars.study,
                            vars.version,
                            vars.osf
                        )) {
                            break;
                        }
                    }
                }
            } catch (e) {
                if(e.message === "quit") {
                    console.log("Quitting on request. Thanks for using osf-upload!");
                    break;
                }
                throw(e);
            }
        }
    } catch (e) {
        // Deal with the fact the chain failed
        console.error(chalk.red(`Failed with error: ${chalk.white(e.message)}`));
    }
})();


