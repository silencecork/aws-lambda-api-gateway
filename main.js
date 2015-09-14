var ENDPOINT = 'https://ofzk89ucs2.execute-api.us-east-1.amazonaws.com/Prod/imageprocessingservice';

angular.module('app', ['ui.bootstrap'])

    .controller('MainController', ['$scope', '$http', function($scope, $http) {
        $scope.loading = false;
        $scope.image = {
            width: 100
        };

        $scope.ready = function() {
            $scope.loading = false;
        };

        $scope.submit = function() {
            var fileCtrl = document.getElementById('image-file');
            if (fileCtrl.files && fileCtrl.files[0]) {
                $scope.loading = true;
                var fr = new FileReader();
                fr.onload = function(e) {
                    $scope.image.base64Image = e.target.result.slice(e.target.result.indexOf(',') + 1);
                    $scope.$apply();
                    document.getElementById('original-image').src = e.target.result;
                    // Now resize!
                    $http.post(ENDPOINT, angular.extend($scope.image, { operation: 'resize', outputExtension: fileCtrl.value.split('.').pop() }))
                        .then(function(response) {
                            document.getElementById('processed-image').src = "data:image/png;base64," + response.data;
                        })
                        .catch(console.log)
                        .finally($scope.ready);
                };
                fr.readAsDataURL(fileCtrl.files[0]);
            }
        };
    }]);