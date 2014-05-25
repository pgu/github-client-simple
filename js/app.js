'use strict';

angular.module('githubClient', ['ui.bootstrap', 'ngAnimate'])

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

  .directive('contributorsHeatmap', function () {
    return {
      restrict: 'E',
      template: '<div></div>',
      replace: true,
      scope: {
        data: '=',
        categories: '='
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
              type: 'heatmap',
              marginTop: 40,
              marginBottom: 40
            },
            title: {
              text: 'Commits per contributors per weekday'
            },
            xAxis: {
              categories: $scope.categories.x
            },
            yAxis: {
              categories: $scope.categories.y,
              title: null
            },
            colorAxis: {
              min: 0,
              minColor: '#FFFFFF',
              maxColor: Highcharts.getOptions().colors[0]
            },
            legend: {
              align: 'right',
              layout: 'vertical',
              margin: 0,
              verticalAlign: 'top',
              y: 25,
              symbolHeight: 320
            },
            tooltip: {
              formatter: function () {
                return '<b>' + this.series.xAxis.categories[this.point.x] + '</b> committed <br><b>' +
                  this.point.value + '</b> commits on <br><b>' + this.series.yAxis.categories[this.point.y] + '</b>';
              }
            },

            series: [{
              name: 'Commits per contributors',
              borderWidth: 1,
              data: $scope.data,
              dataLabels: {
                enabled: true,
                color: 'black',
                style: {
                  textShadow: 'none',
                  HcTextStroke: null
                }
              }
            }]

          });

        });
      }
    };
  })

  .controller('MainCtrl', function ($scope, $http, $q, helper, $location, errorHelper, $timeout) {

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

    function updateContributorsHeatmap (commits) {

      var WEEK_DAYS = ['Sunday', 'Saturday', 'Friday', 'Thursday', 'Wednesday', 'Tuesday', 'Monday'];

      var author2commits = _.groupBy(commits, function(commit) {
          return commit.commit.author.name; // { john: [commits], jane: [commits] }
      });

      var topTenAuthors = _(author2commits)
        .map(function (commits, author) {
          return { name: author, commitsNb : _(commits).size() };
        })
        .sortBy('commitsNb')
        .last(10)
        .reverse()
        .pluck('name')
        .valueOf()
      ;

      var data = _(topTenAuthors).reduce(function(accu, author, authorIdx) {

        var nbCommitsByWeekday = _(author2commits[author])

          .groupBy(function(commit) {
            var commitDateTime = commit.commit.author.date; // 2014-05-19T11:40:48Z
            return moment(commitDateTime).weekday();
          })
          .mapValues(function (commits) {
            return _(commits).size();
          })
            .valueOf()
          ;

        _(WEEK_DAYS).each(function(day, dayIdx) {
          var momentIdx = _.indexOf(moment.weekdays(), day);
          accu.push([authorIdx, dayIdx, nbCommitsByWeekday[momentIdx] || 0]);
        });

        return accu;
      }, []);

      $scope.contributorsHeatCategories = {
        x: topTenAuthors,
        y: WEEK_DAYS
      };

      $scope.contributorsHeatData = data;
    }

    $scope.COMMITS_LIMIT = 100;

    function fetchData (selectedRepo) {

      var repo = selectedRepo || {};

      $scope.goToContributors(repo.contributors_url); //  GET /repos/:owner/:repo/contributors

      fetchLatestCommits(repo, $scope.COMMITS_LIMIT)
        .then(function (commits) {

          updateContributorsChart(commits);
          updateCommitsChart(commits);
          updateContributorsHeatmap(commits);

        });

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

    $scope.$watch(function () { // init the page
      return $location.path();
    }, function (newValue) {
      updatePageForRepo(newValue);
    });

    $scope.onSelectRepo = function (selectedRepo) {
      $scope.selectedRepo = selectedRepo;
      $location.path(selectedRepo.full_name);
    };

  });



