// Take a JavaScript project in a directory, then create a new git repo for it on github (or wherever), and add the existing files to it.
var GitHubApi = require("github");
var bluebird = require('bluebird');
var createRepo = require('github-create-repo');
var fs = require('fs');
const fs_extra = require('fs-extra');

const jsgui = require('jsgui3');
const Fns = jsgui.Fns;
const fs2 = jsgui.fs2;
const util = require('util');
//var ncp = util.promisify(require('ncp').ncp);
var ncp = require('ncp').ncp;
const exec = util.promisify(require('child_process').exec);
const request = require('request');
const path = require('path');

console.log("path.resolve('../../config/config.json')", path.resolve('../../config/config.json'));

var config = require('my-config').init({
    path: path.resolve('../../config/config.json') //,
    //env : process.env['NODE_ENV']
    //env : process.env
});

//console.log('config', config);
//throw 'stop';

var personal_repo_token = config.github_token;
var github_username = config.github_username;
var author = config.author_email;

const gitclone = require('gitclone');
const use_my_gitignore = true;

// could try to repoify all.

var github_repo_exists = (user, repo_name, callback) => {
    // curl https://api.github.com/repos/coldhawaiian/blarblar

    var url = 'https://api.github.com/repos/' + user + '/' + repo_name;
    console.log('url', url);
    request(url, { headers: { 'User-Agent': 'repoify 0.0.1' } }, (error, response, body) => {
        //console.log('error:', error); // Print the error if one occurred
        //console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
        //console.log('body:', body); // Print the HTML for the Google homepage.

        var exists = response.statusCode === 200;
        callback(null, exists);
    });

};

var local_project_dotgit_path = (project_name) => {
    var res_path = path.resolve('../' + project_name + '/.git');
    return res_path;
}

var local_project_gitignore_path = (project_name) => {
    var res_path = path.resolve('../' + project_name + '/.gitignore');
    return res_path;
}

var local_project_package_json_path = (project_name) => {
    var res_path = path.resolve('../' + project_name + '/package.json');
    return res_path;
}

var local_project_path = (project_name) => {
    var res_path = path.resolve('../' + project_name);
    return res_path;
}

//
// fs.stat(path, callback)

// 

var local_project_has_git_repo = (project_name, callback) => {
    fs.stat(local_project_dotgit_path(project_name), (err, stat) => {
        //console.log('err', err);
        //console.log('stat', stat);
        callback(null, !!stat);
    })
}

var local_project_exists = (project_name, callback) => {
    fs2.exists(local_project_path(project_name), callback);
}

var local_project_package_json_exists = (project_name, callback) => {
    fs2.exists(local_project_package_json_path(project_name), callback);
}

var ensure_local_ignore = function (project_name, callback) {
    if (use_my_gitignore) {
        var project_gitignore_path = local_project_gitignore_path(project_name);
        var my_gitignore_path = path.resolve('./.gitignore');

        console.log('my_gitignore_path', my_gitignore_path);
        console.log('project_gitignore_path', project_gitignore_path);
        fs2.copy(my_gitignore_path, project_gitignore_path, callback);
    } else {
        callback(null, true);
    }
}


var rerepoify = (github_username, project_name, callback) => {
    // Clone the repo into a temp directory.

    // is there already a cloned git path there?
    //  if so, delete it.

    var cloned_git_path = path.resolve(cloned_git_path = './' + project_name);
    console.log('cloned_git_path', cloned_git_path);

    fs2.ensure_deleted(cloned_git_path, (err, deleted) => {
        if (err) { callback(err); } else {

            var path_in_github = github_username + '/' + project_name;

            gitclone(path_in_github, { dest: cloned_git_path }, (err) => {
                if (err) { callback(err) } else {
                    console.log('Github repo ' + path_in_github + ' cloned to ' + cloned_git_path);

                    // copy the .git directory into place

                    var cloned_dotgit_path = cloned_git_path + '/.git';
                    var project_dotgit_path = local_project_dotgit_path(project_name);

                    // fs2 move?

                    ensure_local_ignore(project_name, (err, res_ei) => {
                        if (err) { callback(err); } else {
                            fs2.move(cloned_dotgit_path, project_dotgit_path, (err, res_move) => {
                                if (err) { callback(err); } else {
                                    console.log('res_move', res_move);

                                    // then delete the cloned project directory.
                                    //  (copy it over, merging, but keeping the files in the local place?)

                                    setTimeout(() => {
                                        fs2.delete(cloned_git_path, (err, res_delete) => {
                                            if (err) { callback(err); } else {
                                                console.log('temp cloned dir deleted');
                                                callback(null, true);

                                            }
                                        })
                                    }, 150);

                                }
                            });
                        }
                    })
                }
            })
        }
    });
}

var create_repo = (project_name, callback) => {
    var opts = {
        'token': personal_repo_token,
        'private': false,
        'issues': true,
        'wiki': true,
        'downloads': false,
        'license': 'mit'
    };

    createRepo(project_name, opts, (error, repo, info) => {
        // Check for rate limit information... 
        if (info) {
            console.error('Limit: %d', info.limit);
            console.error('Remaining: %d', info.remaining);
            console.error('Reset: %s', (new Date(info.reset * 1000)).toISOString());

        }
        if (error) {
            throw new Error(error.message);
        }
        //console.log( JSON.stringify( repo ) );
        console.log(repo);
        callback(null, repo);

    });
}

// ensure package json
//  if there is no package json file, create the most basic one.

var gen_package_json = (github_username, project_name) => {
    var res = {
        "name": project_name,
        "main": project_name + ".js",
        "license": "MIT",
        "dependencies": {},
        "engines": {
            "node": ">=8.5.0"
        },
        "description": "",
        "author": author,
        "repository": {
            "type": "git",
            "url": "https://github.com/" + github_username + "/" + project_name + ".git"
        },
        "version": "0.0.1",
    }

    return JSON.stringify(res, null, 4);
}

var ensure_local_package_json = (github_username, project_name, callback) => {
    local_project_package_json_exists(project_name, (err, exists) => {
        if (!exists) {
            var str_json = gen_package_json(github_username, project_name);
            fs2.save_file_as_string(local_project_package_json_path(project_name), str_json, callback);

        } else {
            callback(null, true);
        }
    });
}


var ensure_local_various = (github_username, project_name, callback) => {
    Fns([
        [ensure_local_ignore, [project_name]],
        [ensure_local_package_json, [github_username, project_name]]
    ]).go(callback);
}


var clone_to_local = (github_username, project_name, callback) => {
    var path_in_github = github_username + '/' + project_name;
    var cloned_git_path = local_project_path(project_name);

    gitclone(path_in_github, { dest: cloned_git_path }, (err) => {
        if (err) { callback(err) } else {
            console.log('Github repo ' + path_in_github + ' cloned to ' + cloned_git_path);
            callback(null, true);

        }
    });
}

var repoify = (project_name, callback) => {
    if (project_name === '*') {
        repoify_all(callback);
    } else {
        local_project_exists(project_name, (err, local_project_exists) => {
            if (err) { callback(err); } else {
                github_repo_exists(github_username, project_name, (err, remote_exists) => {
                    if (err) {
                        throw err;
                    } else {
                        console.log('local_project_exists', local_project_exists);
                        console.log('remote_exists', remote_exists);
                        // local project exists
                        // check if it exists locally.
                        local_project_has_git_repo(project_name, (err, has_repo) => {
                            if (err) { throw err; } else {
                                console.log('has_repo', has_repo);
                                if (local_project_exists) {
                                    if (remote_exists & !has_repo) {
                                        // or call it local_repoify
                                        rerepoify(github_username, project_name, (err, res) => {
                                            if (err) {
                                                console.trace();
                                                throw err;
                                            } else {
                                                console.log('rerepoify res', res);
                                                callback(null, true);
                                            }
                                        });
                                    }

                                    if (!remote_exists & !has_repo) {
                                        // github username known from access token
                                        create_repo(project_name, (err, res) => {
                                            if (err) { callback(err); } else {
                                                rerepoify(github_username, project_name, (err, res) => {
                                                    if (err) {
                                                        console.trace();
                                                        throw err;
                                                    } else {
                                                        console.log('rerepoify res', res);
                                                        callback(null, true);
                                                    }
                                                });
                                            }
                                        });
                                    }

                                    if (remote_exists && has_repo) {
                                        console.log('Project repo structure exists. Will check specifics');

                                        ensure_local_various(github_username, project_name, (err, res_ignore) => {
                                            if (err) { callback(err); } else {
                                                callback(null, true);
                                            }
                                        });
                                    }

                                } else {
                                    // create the remote repo
                                    // clone it to project repo location
                                    // copy git ignore if necessary

                                    if (remote_exists) {

                                        clone_to_local(github_username, project_name, (err, res) => {
                                            if (err) { callback(err); } else {

                                                console.log('local project and repo created');

                                                ensure_local_various(github_username, project_name, (err, res_ignore) => {
                                                    if (err) { callback(err); } else {
                                                        callback(null, true);
                                                    }
                                                });
                                            }
                                        });
                                    } else {
                                        create_repo(project_name, (err, res) => {
                                            if (err) { callback(err); } else {
                                                // clone_to_local

                                                clone_to_local(github_username, project_name, (err, res) => {
                                                    if (err) { callback(err); } else {

                                                        console.log('local project and repo created');

                                                        ensure_local_various(github_username, project_name, (err, res_ignore) => {
                                                            if (err) { callback(err); } else {
                                                                callback(null, true);
                                                            }
                                                        })


                                                    }
                                                });
                                            }
                                        })

                                    }
                                }
                            }
                        });
                    }
                });
            }
        })
    }


    // could do [local_project_exists, github_repo_exists, local_project_has_git_repo] within fns
    //  not sure about adapting res_all?
    //   try array destructuring.
}

var repoify_all = callback => {
    // find every project / directory name

    // for each of these, determine if there is a github project

}


if (require.main === module) {
    // read the params.
    var my_args = process.argv.slice(2);
    console.log('process.argv', process.argv);
    console.log('my_args', my_args);

    var project_name = my_args[0];

    console.log('project_name', project_name);

    if (project_name === undefined) {
        project_name = '*';
    }
    //throw 'stop';

    repoify(project_name, (err, res_repoify) => {
        if (err) {
            console.trace();
            throw err;
        } else {
            console.log('res_repoify', res_repoify);
        }
    });
} else {
    //console.log('required as a module');
}