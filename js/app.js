'use strict';

angular.module('githubClient', ['ui.bootstrap'])

  .config(function ($httpProvider) {

    $httpProvider.interceptors.push(
      function () {
        return {
          request: function (config) {
            var isCallToGitHub = config.url.indexOf('https://api.github.com') === 0;

            if (isCallToGitHub) {
              config.headers.accept = 'application/vnd.github.v3+json';
            }

            return config;
          }
        };
      }
    );

  })

  .controller('MainCtrl', function ($scope, $http, $q) {

    $scope.searchProject = function (query) {

      var url = 'https://api.github.com/search/repositories';

      var params = {
        q: query,
        sort: 'stars',
        order: 'desc'
      };

      return $http.get(url, { params: params })
        .then(function (res) {
          var response = res.data;
          return response.items;
        });
    };

    function fetchContributors (selectedRepo) {
      $scope.isFetchingContributors = true;
      $scope.contributors = [];

      //  GET /repos/:owner/:repo/contributors
      var contributorsUrl = selectedRepo.contributors_url.replace('{/sha}', '');

      return $http.get(contributorsUrl)

        .then(function (res) {
          $scope.contributors = res.data;
        })

        .finally(function () {
          $scope.isFetchingContributors = false;
        })
        ;

    };

    $scope.commits = [];
    $scope.isFetchingCommits = false;
    var COMMITS_LIMIT = 100;

    function fetchCommitsUntil100 (commitsUrl) {

      return $http.get(commitsUrl)
        .then(function (response) {

          var commits = response.data;

          if (_(commits).isEmpty()) {
            return;
          }

          $scope.commits = $scope.commits.concat(commits);

          var hasReachedLimit = _($scope.commits).size() >= COMMITS_LIMIT;
          if (hasReachedLimit) {
            $scope.commits = _.first($scope.commits, 100);
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

    function fetchLatest100Commits (selectedRepo) {
      $scope.isFetchingCommits = true;
      $scope.commits = [];

      //  https://developer.github.com/v3/repos/commits/
      //  GET /repos/:owner/:repo/commits
      var commitsUrl = selectedRepo.commits_url.replace('{/sha}', '');

      return fetchCommitsUntil100(commitsUrl)
        .finally(function () {
          $scope.isFetchingCommits = false;
        })
        ;
    };

    $scope.noop = function (selected) {
      console.info('> ', selected);
    }

    $scope.onSelectRepo = function (selectedRepo) {

      $q.all([
        fetchLatest100Commits(selectedRepo),
        fetchContributors(selectedRepo)
      ]);

    };

  });



