const Exec = require('child_process').exec;
const path = require('path');
const github = require('./github');

const cwd = path.resolve('../turbo-dev');

function unsafeExec(cmd) {
    console.log(`${cwd} $ ${cmd}`);

    return new Promise((resolve, reject) => {
        Exec(cmd, { cwd }, (error, stdout, stderr) => {
            stdout && console.log(stdout);
            stderr && console.error(stderr);

            error ? reject(error) : resolve();
        });
    });
}

function exec(cmd) {
    return unsafeExec(cmd).catch(() => void 0);
}

module.exports.buildMasterTask = async function buildMasterTask({ action, pull }) {
    try {
        await unsafeExec(`node cli/checkout ${pull}`);
        await unsafeExec(`node cli/build ${pull}`);
    } catch(e) {
        console.error(e);
    }

    await exec('git checkout . && git pull && yarn && pm2 reload pm2.json');
};

module.exports.buildTask = async function buildTask({ action, pull, number, payload }) {
    if (action === 'delete') {
        return await exec(`rm -rf checkout/${pull.replace('/', '-')}`);
    }

    const status = {
        owner: 'turboext',
        repo: 'css',
        number,
        sha: payload.pull_request.head.sha,
        context: 'Deployment'
    };

    github.repos.createStatus({
        ...status,
        description: 'Building in progress...',
        state: 'pending'
    });

    try {
        await unsafeExec(`node cli/checkout ${pull}`);
        await unsafeExec(`node cli/build ${pull}`);
    } catch(e) {
        console.error(e);

        github.repos.createStatus({
            ...status,
            description: e.message,
            state: 'failure'
        });
    }

    github.repos.createStatus({
        ...status,
        description: 'ok',
        target_url: `https://${pull.replace('/', '-')}.turboext.net/`,
        state: 'success'
    });
};
