module.exports = function (gitLabManager, configManager, $q, $http) {
    var MergeRequestFetcher = {};
    MergeRequestFetcher.labels = {};
    var authenticatedUser = null;

    var request = function (url) {
        return $http({
            url: configManager.getUrl() + '/api/v4' + url,
            headers: {'PRIVATE-TOKEN': configManager.getPrivateToken()}
        });
    };

    MergeRequestFetcher.getUsers = function (userNames) {
        var url = '/users?username=';
        var users = [];
        var usersRequests = [];

        userNames.forEach(function (element) {
            var userUrl = url + element;
            usersRequests.push(
                request(userUrl).then(
                    function (response) {
                        users.push(response.data[0]);
                    }
                )
            );
        });

        return $q.all(usersRequests).then(function () {
            return users;
        });
    };

    MergeRequestFetcher.getMergeRequests = function (users) {
        var url = '/merge_requests?state=opened&scope=all&order_by=updated_at&author_id=';
        var mergeRequestRequests = [];

        users.forEach(function (user) {
            mergeRequestRequests.push(
                request(url + user.id).then(function (response) {
                    var userMergeRequests = response.data;

                    return $q.all([
                        userMergeRequests.map(addProjectToMergeRequest),
                        userMergeRequests.map(addVotesToMergeRequest),
                        userMergeRequests.map(addCiStatusToMergeRequest),
                        userMergeRequests.map(formatLabelsForMergeRequest)
                    ]).then(function () {
                        return userMergeRequests;
                    });
                })
            )
        });

        return $q.all(mergeRequestRequests);


    };

    var addProjectToMergeRequest = function (mergeRequest) {
        var url = '/projects/' + mergeRequest.project_id;
        return request(url).then(function (response) {
            var project = response.data;
            mergeRequest.project = {};
            mergeRequest.project.name = project.name_with_namespace;
            mergeRequest.project.web_url = project.web_url;
        });
    };
    var addVotesToMergeRequest = function (mergeRequest) {
        if (mergeRequest.upvotes === 0 && mergeRequest.downvotes === 0) {
            return;
        }

        var url = '/projects/' + mergeRequest.project_id + '/merge_requests/' + mergeRequest.iid + '/award_emoji?per_page=100';
        return request(url).then(function (response) {
            var awards = response.data;

            mergeRequest.upvoters = [];
            mergeRequest.downvoters = [];
            mergeRequest.i_have_voted = 0;
            awards.forEach(function (award) {

                if (award.name === 'thumbsup') {
                    mergeRequest.upvoters.push(award.user.name);

                    if (award.user.id === authenticatedUser.id) {
                        mergeRequest.i_have_voted = 1;
                    }
                }

                if (award.name === 'thumbsdown') {
                    mergeRequest.downvoters.push(award.user.name);

                    if (award.user.id === authenticatedUser.id) {
                        mergeRequest.i_have_voted = -1;
                    }
                }
            });
        });
    };
    var addCiStatusToMergeRequest = function (mergeRequest) {
        var url = '/projects/' + mergeRequest.project_id + '/pipelines?ref=' + encodeURIComponent(mergeRequest.source_branch);
        return request(url).then(function (response) {
            var pipelines = response.data;

            if (pipelines.length === 0) {
                return;
            }

            var pipeline = pipelines[0];

            mergeRequest.ci = {
                pipeline_id: pipeline.id,
                status: pipeline.status
            };
        });
    };
    var formatLabelsForMergeRequest = function (mergeRequest) {
        if (MergeRequestFetcher.labels[mergeRequest.project_id] !== undefined) {
            mergeRequest.formatted_labels = [];
            mergeRequest.labels.forEach(function (label) {
                mergeRequest.formatted_labels.push(MergeRequestFetcher.labels[mergeRequest.project_id][label]);
            });
        }

        var url = '/projects/' + mergeRequest.project_id + '/labels';
        return request(url).then(function (response) {
            MergeRequestFetcher.labels[mergeRequest.project_id] = {};
            response.data.forEach(function (label) {
                MergeRequestFetcher.labels[mergeRequest.project_id][label.name] = label;
            });

            mergeRequest.formatted_labels = [];
            mergeRequest.labels.forEach(function (label) {
                mergeRequest.formatted_labels.push(MergeRequestFetcher.labels[mergeRequest.project_id][label]);
            });
        });
    };

    gitLabManager.getUser().then(function (user) {
        authenticatedUser = user;
    });

    return MergeRequestFetcher;
};
