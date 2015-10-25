$(document).ready( function () {

    $('.show').click( function () {
        var tabID = $(this).attr('data-tab');
        var alreadyOpen = false;
        if ($('#'+tabID).hasClass('current')) {
            alreadyOpen = true;
        }

        $('#intro a').removeClass('current');
        $('#intro div').removeClass('current');

        // Allows you to toggle tabs open/closed
        if (!alreadyOpen) {
            $(this).addClass('current');
            $('#'+tabID).addClass('current');
        }
    });

    $('#show-definitions').click( function() {
        $('#definitions').show();
        $('#objects').hide();
        $('#functions').hide();
        $('#closures').hide();
        $('#modules').hide();
    });

    $('#show-objects').click( function() {
        $('#definitions').hide();
        $('#objects').show();
        $('#functions').hide();
        $('#closures').hide();
        $('#modules').hide();
    });

    $('#show-functions').click( function() {
        $('#definitions').hide();
        $('#objects').hide();
        $('#functions').show();
        $('#closures').hide();
        $('#modules').hide();
    });

    $('#show-closures').click( function() {
        $('#definitions').hide();
        $('#objects').hide();
        $('#functions').hide();
        $('#closures').show();
        $('#modules').hide();
    });

    $('#show-modules').click( function() {
        $('#definitions').hide();
        $('#objects').hide();
        $('#functions').hide();
        $('#closures').hide();
        $('#modules').show();
    });

    $('#run-button').click( function( event ) {
        var result = '';
        var hatchCode = $('#code').val();
        try {
            var jsCode = Hatch.run(hatchCode);
            var f = new Function(jsCode);
            result = f();
        } catch (error) {
            result = 'ERROR: ' + error.message;
        }
        $('#output').html(result);
    });

    $('#js-button').click( function( event ) {
        var result = '';
        var hatchCode = $('#code').val();
        try {
            result = Hatch.run(hatchCode);
        } catch (error) {
            result = 'ERROR: ' + error.message;
        }
        $('#output').html(result);
    });

    $('#code').on('keydown', function ( event ) {
        if (event.keyCode === 9) {
            event.preventDefault();
            var start = $(this).get(0).selectionStart;
            var end = $(this).get(0).selectionEnd;
            $(this).val($(this).val().substring(0, start) + '\t' + $(this).val().substring(end));
            $(this).get(0).selectionStart =
                $(this).get(0).selectionEnd = start + 1;
        }
    });
});
