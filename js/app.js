'use strict';

angular.module('githubClient', ['ui.bootstrap'])

  .controller('MainCtrl', function ($scope, $http) {

    $scope.searchProject = function (query) {

      var url = 'https://api.github.com/search/repositories';

      var headers = {
        Accept: 'application/vnd.github.v3+json'
      };

      var params = {
        q: query,
        sort: 'stars',
        order: 'desc'
      };

      return $http.get(url, { params: params, headers: headers })
        .then(function (res) {
          var response = res.data;
          return response.items;
        });
    };

    $scope.fetchContributors = function (selectedRepo) {

      console.info('> selectedRepo ', selectedRepo);

      var url = 'https://api.github.com/repos/' + selectedRepo + '/contributors';
      var headers = {
        Accept: 'application/vnd.github.v3+json'
      };
      return $http.get(url, { headers: headers })
        .then(function (res) {
          var response = res.data;
          $scope.contributors = response;
        });

    };

    $scope.commits = [];
    $scope.isFetchingCommits = false;
    var COMMITS_LIMIT = 100;

    function fetchCommitsUntil100 (commitsUrl) {

      var headers = {
        Accept: 'application/vnd.github.v3+json'
      };

      return $http.get(commitsUrl, { headers: headers })
        .then(function (response) {

          var commits = response.data;

          if (_(commits).isEmpty()) {
            return;
          }

          $scope.commits = $scope.commits.concat(commits);

          var hasReachedLimit = _($scope.commits).size() >= COMMITS_LIMIT;
          if (hasReachedLimit) {
            return;
          }

          var headers = response.headers();

          //  Header Link: <https://api.github.com/repositories/4991291/commits?page=2>; rel="next"
          var noNextPage = !_.has(headers, 'link') ||
            headers.link.indexOf('rel="next"') === -1;

          if (noNextPage) {
            return;
          }

          var links = headers.link.split(', ');
          var nextLink = _.find(links, function (link) {
            return link.indexOf('rel="next"') !== -1;
          });

          var fmtUrl = _(nextLink.split(';')).first();
          var urlNextPage = fmtUrl.replace(/<|>/g, '');

          return fetchCommitsUntil100(urlNextPage);

        });
    }

    $scope.fetchLatest100Commits = function (selectedRepo) {
      $scope.isFetchingCommits = true;
      $scope.commits = [];

      //  https://developer.github.com/v3/repos/commits/
      //  GET /repos/:owner/:repo/commits
      var commitsUrl = selectedRepo.commits_url.replace('{/sha}', '');

      fetchCommitsUntil100(commitsUrl)
        .finally(function () {
          $scope.isFetchingCommits = false;
        })
      ;
    };

    $scope.noop = function (selected) {
      console.info('> ', selected);
    }

  });



