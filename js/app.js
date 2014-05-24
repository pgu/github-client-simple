'use strict';

angular.module('githubClient', ['ui.bootstrap'])

  .config(function ($httpProvider) {

    function isCallToGitHub (config) {
      return config.url.indexOf('https://api.github.com') === 0;
    }

    $httpProvider.interceptors.push(
      function (errorHelper) {
        return {
          request: function (config) {

            if (isCallToGitHub(config)) {
              config.headers.accept = 'application/vnd.github.v3+json';
            }

            return config;
          },
          responseError: function (rejection) {

            if (isCallToGitHub(rejection.config)) {

              var headers = rejection.headers();
              var reset = headers['x-ratelimit-reset'] || '';

              var newError = {
                url: rejection.config.url,
                message: rejection.data.message,
                documentation_url: rejection.data.documentation_url,
                limit: headers['x-ratelimit-limit'] || '',
                remaining: headers['x-ratelimit-remaining'] || '',
                reset: reset ? moment.unix(reset).format('llll') : ''
              };

              // avoid duplicates
              var url2error = _.indexBy(errorHelper.apiCallErrors, 'url');
              url2error[newError.url] = newError;
              errorHelper.apiCallErrors = _.values(url2error);
            }

            return rejection;
          }
        };
      }
    );

  })

  .factory('errorHelper', function () {
    return {
      apiCallErrors: []
    };
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

  .directive('contributorsList', function ($timeout) {
    return {
      restrict: 'E',
      templateUrl: 'directives/contributorsList.html',
      replace: true,
      scope: {
        contributors: '=',
        start: '=',
        stop: '='
      },
      link: function ($scope) {

        $scope.$watch('contributors', function () {
          $timeout(function () {
            if ($('[data-toggle=tooltip]').length) {
              $('[data-toggle=tooltip]').tooltip();
            }
          });
        })

      }
    }
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

  .directive('commitsChart', function () {
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
              type: 'spline'
            },
            title: {
              text: 'Commits through time'
            },
            xAxis: {
              type: 'datetime',
              dateTimeLabelFormats: {
                day: '%e %b %y',
                week: '%e %b %y',
                month: '%b %y',
                year: '%Y'
              },
              title: {
                text: 'Date'
              }
            },
            yAxis: {
              title: {
                text: 'Number of commits'
              },
              min: 0
            },
            tooltip: {
              headerFormat: '<b>{series.name}</b><br>',
              pointFormat: '{point.x:%e %b %Y}: {point.y} commits'
            },

            series: [
              {
                name: '# of commits',
                data: $scope.data
              }
            ]
          });

        });
      }
    };
  })

  .controller('MainCtrl', function ($scope, $http, $q, helper, $location, errorHelper) {

    $scope.errorHelper = errorHelper;

    $scope.searchProject = function (query) {

      var url = 'https://api.github.com/search/repositories';

      var params = {
        q: query,
        sort: 'stars',
        order: 'desc'
      };

      return $http.get(url, { params: params })
        .then(function (res) {
          return res.data.items;
        });
    };

    $scope.goToContributors = function (url) {

      if (!url) {
        $scope.contributors = [];
        $scope.contributorsPreviousLabel = '';
        $scope.contributorsNextLabel = '';

        return;
      }

      $scope.isFetchingContributors = true;

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

        .catch(function () {
          $scope.contributors = [];
          $scope.contributorsPreviousLabel = '';
          $scope.contributorsNextLabel = '';
        })

        .finally(function () {
          $scope.isFetchingContributors = false;
        })
        ;

    };

    function fetchCommits (url, limit, accu) {

      return $http.get(url)
        .then(function (response) {

          var commits = response.data;

          if (_(commits).isEmpty()) {
            return accu;
          }

          _(commits).some(function (commit) {
            accu.push(commit);
            return _(accu).size() === limit;
          });

          if (_(accu).size() === limit) {
            return accu;
          }

          var urlNextPage = helper.getNextUrl(response);
          if (!urlNextPage) {
            return accu;
          }

          return fetchCommits(urlNextPage, limit, accu);
        });
    }

    function fetchLatestCommits (selectedRepo, limit) {

      if (!selectedRepo.commits_url) {
        return $q.when([]);
      }

      $scope.isFetchingCommits = true;

      //  https://developer.github.com/v3/repos/commits/
      //  GET /repos/:owner/:repo/commits
      var commitsUrl = selectedRepo.commits_url.replace('{/sha}', '');

      return fetchCommits(commitsUrl, limit, [] /* accu */)
        .finally(function () {
          $scope.isFetchingCommits = false;
        })
        ;
    };

    function updateContributorsChart (commits) {

      $scope.contributorsChartData = _(commits)

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
    }

    function updateCommitsChart (commits) {

      $scope.commitsChartData = _(commits)

        .groupBy(function (commit) {
          var commitDateTime = commit.commit.author.date; // 2014-05-19T11:40:48Z
          var commitDate = commitDateTime.replace(/T.+$/gi, 'T00:00:00Z'); // 2014-05-19T00:00:00Z
          return moment(commitDate).valueOf(); // { 1400457600000: [commits] }
        })

        .map(function (commits, key) {
          return [_.parseInt(key), _(commits).size()];
        }) // [ [1400457600000, 42] ]

        .sortBy('0')
        .valueOf()
      ;

    }

    $scope.COMMITS_LIMIT = 100;

    function fetchData (selectedRepo) {

      var repo = selectedRepo || {};

      $scope.goToContributors(repo.contributors_url); //  GET /repos/:owner/:repo/contributors

//      fetchLatestCommits(repo, $scope.COMMITS_LIMIT)
//        .then(function (commits) {
//
//          updateContributorsChart(commits);
//          updateCommitsChart(commits);
//
//        });

    };

    function fetchRepo (repoFullName) {

      if (_.isEmpty(repoFullName)) {
        return $q.when(null);
      }

      var repoHasBeenSelected = $scope.selectedRepo && $scope.selectedRepo.full_name === repoFullName;
      if (repoHasBeenSelected) {
        return $q.when($scope.selectedRepo);
      }

      return $http.get('https://api.github.com/repos' + repoFullName)
        .then(function (res) {
          return res.data;
        })
        .catch(function () {
          return null;
        })
        ;
    }

    function updatePageForRepo (repoFullName) {

      errorHelper.apiCallErrors = [];

      fetchRepo(repoFullName)
        .then(function (repo) {
          $scope.selectedRepo = repo;
          return repo;
        })
        .then(fetchData)
      ;

    }

    $scope.$watch(function () {
      return $location.path();
    }, function (newValue) {
      updatePageForRepo(newValue);
    });

    updatePageForRepo($location.path());

    $scope.onSelectRepo = function (selectedRepo) {
      $scope.selectedRepo = selectedRepo;
      $location.path(selectedRepo.full_name);
    };

  });



