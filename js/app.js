'use strict';

angular.module('githubClient', ['ui.bootstrap'])

  .controller('MainCtrl', function ($scope, $http) {
    $scope.awesomeThings = [
      'HTML5 Boilerplate',
      'AngularJS',
      'Karma'
    ];

    $scope.searchProject = function (val) {

      if (_(val).size() < 3) {
        return [];
      }

      var url = 'https://api.github.com/search/repositories';

      var headers = {
        Accept: 'application/vnd.github.v3+json'
      };

      var params = {
        q: val,
        sort: 'stars',
        order: 'desc'
      };

      return $http.get(url, { params: params, headers: headers })
        .then(function (res) {
          var response = res.data;

          return _.map(response.items, function (item) {
            return item.full_name;
          });
        });
    };

    $scope.fetchContributors = function (selectedRepo) {

      console.info('> selectedRepo ', selectedRepo);

      var url = 'https://api.github.com/repos/' + selectedRepo + '/contributors';
      var headers = {
        Accept: 'application/vnd.github.v3+json'
      };
      return $http.get(url, { headers: headers })
        .then(function(res) {
          var response = res.data;
          $scope.contributors = response;
        });

    };


  });



