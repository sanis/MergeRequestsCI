module.exports = function ($interval, MergeRequestFetcher, configManager, favicoService, moment) {
    var vm = this;
    vm.refresh = function () {
        var users = configManager.getUsers();

        MergeRequestFetcher.getUsers(
            users.split("\n")
        ).then(function (users) {
            vm.users = users;

            MergeRequestFetcher.getMergeRequests(vm.users).then(function (mergeRequests) {
                var allMergeRequests = [];

                mergeRequests.forEach(function (userMergeRequests) {
                    userMergeRequests.forEach(function (userMergeRequest) {
                        allMergeRequests.push(userMergeRequest);
                    })
                });

                allMergeRequests.sort(
                    function (a, b) {
                        //return a.id < b.id;
                        return moment(a.updated_at, moment.ISO_8601).unix() > moment(b.updated_at, moment.ISO_8601).unix() ? -1 : 1;
                    }
                );

                vm.mergeRequests = allMergeRequests;

                favicoService.badge(allMergeRequests.length);
            });
        });

    };

    $interval(function () {
        vm.refresh();
    }, configManager.getRefreshRate() * 60 * 1000);

    vm.displayBranchColumn = configManager.displayBranchColumn();
    vm.displayLabelsColumn = configManager.displayLabelsColumn();

    vm.refresh();
};
