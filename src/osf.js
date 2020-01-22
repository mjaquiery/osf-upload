const fetch = require('node-fetch');
const chalk = require('chalk');

/**
 * Show the proposed files to upload from dir to osf
 * @param dir {string} remote directory to pull files from
 * @param study {string} study name
 * @param version {string} version number
 * @param osf {string} osf repository id
 *
 * @return {boolean} whether the proposed operation is likely to succeed
 */
async function showDetails(dir, study, version, osf) {
    const filter = `${study}_v${version}`;
    const rawDir = dir + (dir[dir.length - 1] === "/"? "" : "/") + "raw";
    // List dir files matching the study_version requirements
    const files = await listFiles(dir, filter);

    console.log(chalk.green(`Found ${chalk.white(files.length)} .csv file(s) to upload to main OSF directory.`));

    const dicts = await getDictionaries(files);

    console.log(chalk.green(`Found ${chalk.white(dicts.length)} data dictionary files.`));

    const rawFiles = await listFiles(rawDir, filter);

    console.log(chalk.green(`Found ${chalk.white(rawFiles.length)} .json file(s) to upload to raw OSF directory.`));

    // Test OSF API link
    const rawURL = await getRawDir(osf);

    console.log(chalk.green(`Found raw data directory ${chalk.white(osf + "/providers/osfstorage" + rawURL)}.`));

    return true;
}

/**
 * Upload files from dir to osf and print out a report.
 * @param dir {string} remote directory to pull files from
 * @param study {string} study name
 * @param version {string} version number
 * @param osf {string} osf repository id
 *
 * @return {boolean} whether the operation succeeded completely
 */
async function uploadFiles(dir, study, version, osf) {
    const filter = `${study}_v${version}`;
    const rawDir = dir + (dir[dir.length - 1] === "/"? "raw/" : "/raw/");
    const rawFiles = await listFiles(rawDir, filter);

    let files = await listFiles(dir, filter);
    const dicts = await getDictionaries(files);
    files = [...files, ...dicts];

    let okay = [];
    let failed = [];
    let skipped = [];

    for(let toRaw of [false, true]) {
        const target = `http://files.osf.io/v1/resources/${osf}/providers/osfstorage` +
            (toRaw? await getRawDir(osf) : "/");
        const root = toRaw?
            rawDir : dir + (dir[dir.length - 1] === "/"? "" : "/");
        const fileList = toRaw? rawFiles : files;

        for await(let f of fileList) {
            const path = root + f;
            const file = await fetch(path).then(r => r.text());
            await fetch(
                `${target}?kind=file&name=${f}`,
                {
                    method: 'put',
                    body: file,
                    headers: {
                        Authorization: `Bearer ${process.env.OSF_PAT}`
                    }
                }
            )
                .then((r) => {
                    switch(r.status) {
                        case 201:
                            console.log(`Upload of ${f} ${chalk.green("okay")}.`);
                            okay.push(f);
                            break;
                        case 409:
                            console.log(`Upload of ${f} ${chalk.yellow("skipped")}.`);
                            skipped.push(f);
                            break;
                        default:
                            throw(new Error(`${r.status}: ${r.statusText}`));
                    }
                })
                .catch((e) => {
                    console.log(`Upload of ${f} ${chalk.red("failed")}.`);
                    console.log(chalk.red(e));
                    failed.push(f);
                });
        }
    }

    console.log(`Upload complete. Successfully uploaded ${chalk.green(okay.length)} files, ${chalk.yellow(skipped.length)} skipped, ${chalk.red(failed.length)} errors.`);

    return true;
}

async function getRawDir(osf) {
    const osfResponse =
        await fetch(`http://files.osf.io/v1/resources/${osf}/providers/osfstorage/`)
            .then(res => res.json());

    if(!osfResponse || !osfResponse.data) {
        throw(new Error(`Unable to connect to http://files.osf.io/v1/resources/${osf}/providers/osfstorage/`));
    }

    // Check for raw folder
    let raw = null;
    for(let i = 0; i < osfResponse.data.length; i++) {
        if(osfResponse.data[i].attributes.name === "raw") {
            raw = osfResponse.data[i];
            break;
        }
    }

    if(!raw)
        throw(new Error(`Unable to find raw/ directory in OSF: ${osf}.`));

    return raw.attributes.path;
}

/**
 * Fetch a list of file names from url which pass the filter str
 * @param url {string} url to search
 * @param str {string} filter for valid filenames
 * @return {PromiseLike<Array | never> | Promise<Array | never>}
 */
function listFiles(url, str) {
    return fetch(url)
        .then(res => res.text())
        .then(body => getFileLinks(body, str));
}

/**
 * Fetch a list of data dictionaries for the supplied data files
 * @param csvFileList {string[]} csv filenames to retrieve dictionaries for
 * @return {Promise<Array>}
 */
async function getDictionaries(csvFileList) {
    const dicts = [];
    for await(let f of csvFileList) {
        const match = /v[0-9]+-[0-9]+-[0-9]+_([^_]+\.csv)/.exec(f);
        const dictName = `dictionary_${match[1]}`;
        dicts.push(dictName);
    }
    return dicts;
}

/**
 * Get an array with the file links matching strFilter in body
 * @param body {string} HTML body of a listing page
 * @param strFilter {string} filter for the target file names
 * @return {Array}
 */
function getFileLinks(body, strFilter) {
    const re = RegExp(`href="([0-9_\-]*${strFilter}_[^"]+\.[(?:csv)|(?:json)])"`, 'g');
    const out = [];
    while(true) {
        const matches = re.exec(body);
        if(!matches)
            break;
        out.push(matches[1]);
    }
    return out;
}

module.exports = {
    showDetails,
    uploadFiles
};