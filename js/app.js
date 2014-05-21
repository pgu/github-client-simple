'use strict';

angular.module('githubClient', ['ui.bootstrap'])

  .config(function ($httpProvider) {

    // TODO X-RateLimit-Limit:60
//    X-RateLimit-Remaining:55
//    X-RateLimit-Reset:1400704560

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

  .factory('helper', function () {

    //  ex: Header Link:
    //  <https://api.commits?page=3>; rel="next",
    //  <https://api.commits?page=1>; rel="first",
    //  <https://api.commits?page=1>; rel="prev"
    //  <https://api.contributors?page=2>; rel="next",
    //  <https://api.contributors?page=2>; rel="last"

    function getUrl (type, response) {
      var headers = response.headers();
      var rel = 'rel="' + type + '"';

      var noLinkInResponse = !_.has(headers, 'link') ||
        headers.link.indexOf(rel) === -1;

      if (noLinkInResponse) {
        return '';
      }

      var links = headers.link.split(', ');
      var theLink = _.find(links, function (link) {
        return link.indexOf(rel) !== -1;
      });

      var fmtUrl = _(theLink.split(';')).first();
      var url = fmtUrl.replace(/<|>/g, '');

      return url;
    }

    return {

      getNextUrl: function (response) {
        return getUrl('next', response);
      },

      getPreviousUrl: function (response) {
        return getUrl('prev', response);
      }

    };
  })

  .controller('MainCtrl', function ($scope, $http, $q, helper) {

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

    $scope.goToContributors = function (url) {
      if (!url) {
        return;
      }

      $scope.isFetchingContributors = true;
      $scope.contributors = [];


      return $http.get(url)

        .then(function (res) {
          $scope.contributorsPreviousUrl = helper.getPreviousUrl(res);
          $scope.contributorsNextUrl = helper.getNextUrl(res);
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

      //  GET /repos/:owner/:repo/contributors
      var contributorsUrl = selectedRepo.contributors_url;

      $scope.goToContributors(contributorsUrl);
//      fetchLatest100Commits(selectedRepo);

    };

  });



