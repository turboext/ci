const http = require('http');
const createHandler = require('github-webhook-handler');
const handler = createHandler({ path: '/webhook', secret: process.env.WEBHOOK_SECRET_KEY });
const async = require('async');
const { buildTask, buildMasterTask } = require('./build-task');
const githubTask = require('./github-task');

const port = process.env.NODE_PORT || 7777;

const buildQueue = async.queue((task, callback) => {
    if (task.action) {
        buildMasterTask(task).then(() => callback()).catch(e => {
            console.error(e);
            callback();
        });
        return;
    }

    buildTask(task).then(() => callback()).catch(e => {
        console.error(e);
        callback();
    });
}, 1);

const githubQueue = async.queue((task, callback) => {
    githubTask(task).then(() => callback()).catch(e => {
        console.error(e);
        callback();
    });
}, 1);

http.createServer((req, res) => {
    handler(req, res, () => {
        res.statusCode = 404;
        res.end('no such location');
    });
}).listen(port, () => console.log(`Server launched at ${port}`));

handler.on('error', err => {
    console.error('Error:', err.message);
});

handler.on('push', event => {
    console.log(`Received a push event for ${event.payload.ref}`);
    if (event.payload.ref !== 'refs/heads/master') {
        return;
    }

    buildQueue.push({ action: 'build-master', pull: 'master' });
});

handler.on('pull_request', event => {
    const payload = event.payload;
    const number = payload.pull_request.number;

    console.log(`Received a pull event: PR#${number}, ${payload.action}`);

    if (payload.action === 'closed') {
        buildQueue.push({ action: 'delete', pull: `pull/${number}`, number, payload });
    } else if (['synchronize', 'opened', 'reopened'].includes(payload.action)) {
        githubQueue.push(payload);
        buildQueue.push({ action: 'build', pull: `pull/${number}`, number, payload });
    }
});
