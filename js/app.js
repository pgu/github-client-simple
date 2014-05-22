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

      getNextUrl: _.partial(getUrl, 'next'),
      getPreviousUrl: _.partial(getUrl, 'prev'),
      getFirstUrl: _.partial(getUrl, 'first'),
      getLastUrl: _.partial(getUrl, 'last')

    };
  })

  .directive('contributorsChart', function () {
    return {
      restrict: 'E',
      template: '<div></div>',
      replace: true,
      scope: {
        data: '='
      },
      link: function ($scope, element, attrs) {

        var id = attrs.id;

        $scope.$watch('data', function () {

          if (_.isEmpty($scope.data)) {
            $('#' + id).empty();
            return;
          }

          $('#' + id).highcharts({
            chart: {
              plotBackgroundColor: null,
              plotBorderWidth: null,
              plotShadow: false
            },
            title: {
              text: 'Impacts of each contributor based on their commits number'
            },
            tooltip: {
              pointFormat: '{series.name}: <b>{point.y}</b> commits'
            },
            plotOptions: {
              pie: {
                allowPointSelect: true,
                cursor: 'pointer',
                dataLabels: {
                  enabled: true,
                  format: '<b>{point.name}</b>: {point.y}',
                  style: {
                    color: (Highcharts.theme && Highcharts.theme.contrastTextColor) || 'black'
                  }
                }
              }
            },
            series: [
              {
                type: 'pie',
                name: 'Contributor share',
                data: $scope.data
              }
            ]
          });
        });

      }
    }
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

      $scope.isFetchingContributors = true;
      $scope.contributors = [];

      $scope.contributorsPreviousLabel = '';
      $scope.contributorsNextLabel = '';

      return $http.get(url)

        .then(function (res) {
          $scope.contributorsPreviousUrl = helper.getPreviousUrl(res);
          $scope.contributorsNextUrl = helper.getNextUrl(res);
          $scope.contributors = res.data;

          var isFirst = $scope.contributorsPreviousUrl === helper.getFirstUrl(res);
          $scope.contributorsPreviousLabel = isFirst ? 'First' : 'Previous';

          var isLast = $scope.contributorsNextUrl === helper.getLastUrl(res);
          $scope.contributorsNextLabel = isLast ? 'Last' : 'Next';

        })

        .finally(function () {
          $scope.isFetchingContributors = false;
        })
        ;

    };

    $scope.commits = [];
    $scope.isFetchingCommits = false;

    function fetchCommits (commitsUrl, commits_limit) {

      return $http.get(commitsUrl)
        .then(function (response) {

          var commits = response.data;

          if (_(commits).isEmpty()) {
            return;
          }

          $scope.commits = $scope.commits.concat(commits);

          var hasReachedLimit = _($scope.commits).size() >= commits_limit;
          if (hasReachedLimit) {
            $scope.commits = _.first($scope.commits, commits_limit);
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

          return fetchCommits(urlNextPage, commits_limit);

        });
    }

    function fetchLatestCommits (selectedRepo, nbCommits) {
      $scope.isFetchingCommits = true;
      $scope.commits = [];

      //  https://developer.github.com/v3/repos/commits/
      //  GET /repos/:owner/:repo/commits
      var commitsUrl = selectedRepo.commits_url.replace('{/sha}', '');

      return fetchCommits(commitsUrl, nbCommits)
        .finally(function () {
          $scope.isFetchingCommits = false;
        })
        ;
    };

    $scope.noop = function (selected) {
      console.info('> ', selected);
    }

    $scope.nbCommits = 100;

    $scope.onSelectRepo = function (selectedRepo) {

      $scope.goToContributors(selectedRepo.contributors_url); //  GET /repos/:owner/:repo/contributors

      $scope.contributorsChartData = [];

      fetchLatestCommits(selectedRepo, $scope.nbCommits)
        .then(function () {

          $scope.contributorsChartData = _($scope.commits)
            .groupBy(function (commit) {
              return commit.commit.author.name; // { john: [commits], jane: [commits] }
            })
            .mapValues(function (commits) { // { john: 42, jane: 21 }
              return _(commits).size();
            })
            .pairs() // [ [john, 42], [jane, 21] ]
            .sortBy('1') // [ [jane, 21], [john, 42] ]
            .valueOf()
          ;

        });

    };

  });



