/** globals epoch_vars */
jQuery( document ).ready( function ( $ ) {

    (function ( $, app ) {
        /**
         * Bootstrap
         *
         * @since 0.0.1
         */
        app.init = function() {
            //element for the form wrap
            app.form_wrap_el = document.getElementById( epoch_vars.form_wrap );

            //element for comments area
            app.comments_wrap_el = document.getElementById( epoch_vars.comments_wrap );

            //element for template
            app.template_el = document.getElementById( epoch_vars.comments_template_id );

            //stores number of comments we have in the DOM.
            app.last_count = 0;

            //highest comment ID we have parsed
            app.highest_id = 0;

            //Will be set to true if post has no comments, may be use to shut down system in app.shutdown
            app.no_comments = false;

            //Will be set to true if comments are closed, may be use to shut down system in app.shutdown
            app.comments_close = false;

            //used to stop the system
            app.shut_it_off = false;

            //change action for comment form
            app.form_el = document.getElementById( epoch_vars.form_id );
            if ( null != app.form_el) {
                app.form_el.removeAttribute( 'action' );
                app.form_el.setAttribute( 'action', 'post' );
            }

            /**
             * Start the system
             */
            app.set_width();
            app.comments_open();
            app.comment_count( false );
            window.onresize = function(event) {
               app.set_width();
            };

            /**
             * Poll for new comments when page is visible only.
             */
            Visibility.every( epoch_vars.epoch_options.interval, function () {
                if ( false == app.shut_it_off ) {
                    app.comment_count( true );
                }
            });

            /**
             * Submit form data
             *
             * @since 0.0.1
             */
            $( app.form_el ).submit( function( event ) {
                event.preventDefault();
                app.shut_it_off = true;

                //validate fields
                fail = false;
                fail_log = '';
                $( app.form_el ).find( 'select, textarea, input' ).each(function(){
                    if( ! $( this ).prop( 'required' )){

                    } else {
                        if ( ! $( this ).val() ) {
                            fail = true;
                            name = epoch_ucwords( $( this ).attr( 'name' ) );
                            fail_log += name + ' ' + epoch_translation.is_required + ".\n";
                        }

                    }
                });

                //submit if fail never got set to true
                if ( ! fail ) {
                    data = $( this ).serializeArray();
                    $.post(
                        epoch_vars.submit_api_url,
                        data
                    ).complete( function () {

                        } ).success( function ( response ) {
                            app.form_el.reset();
                            $( '#comment_parent' ).val( '0' );

                            if ( true == epoch_vars.postmatic_active && false == epoch_vars.postmatic_site_subscribed ) {
                                $( '<div>' ).data( {
                                    modal: 'postmatic-widget',
                                    request: '#epoch-postmatic-widget',
                                    autoload: true
                                } ).baldrick();
                            }


                            //test if WordPress moved the form
                            temp_el = document.getElementById( 'wp-temp-form-div' );
                            if ( null != temp_el ) {
                                respond_el = document.getElementById( 'respond' );
                                $( respond_el ).insertAfter( temp_el );

                            }

                            app.last_count += 1;
                            response = app.get_data_from_response( response );
                            comment = response.comment;

                            id = parseInt( comment.comment_ID, 10 );
                            if ( app.highest_id < id ) {
                                app.highest_id = id;
                            }

                            //parse if comment isn't in DOM already
                            if ( null == document.getElementById( 'comment-' + comment.comment_ID ) ) {
                                html = app.parse_comment( comment );

                                if ( 0 == comment.comment_parent && 'DESC' == epoch_vars.epoch_options.order ) {
                                    first_child = app.comments_wrap_el.firstChild;
                                    new_el = document.createElement( 'div' );
                                    new_el.innerHTML = html;
                                    app.comments_wrap_el.insertBefore( new_el, first_child );
                                } else {
                                    app.put_comment_in_dom( html, comment.comment_parent, comment.depth );
                                }

                                comment_el = document.getElementById( 'comment-' + comment.comment_ID );
                                if ( null != comment_el ) {
                                    $( comment_el ).addClass( 'epoch-success' ).delay( 2500 ).queue( function ( next ) {
                                        $( this ).removeClass( 'epoch-success' );
                                        next();
                                    } );

                                }
                            }

                            app.shut_it_off = false;

                        } ).fail( function ( xhr ) {
                            $( app.form_wrap_el, 'textarea#comment' ).addClass( 'epoch-failure' ).delay( 2500 ).queue( function ( next ) {
                                $( this ).removeClass( 'epoch-failure' );
                                next();
                            } );
                        } );
                } else {
                    $( app.form_wrap_el, 'textarea#comment' ).addClass( 'epoch-failure' ).delay( 2500 ).queue( function ( next ) {
                        $( this ).removeClass( 'epoch-failure' );
                        next();
                    } );
                    alert( fail_log );
                }
            });

        };

        /**
         * Check if comments are open for current post
         *
         * @since 0.0.1
         */
        app.comments_open = function() {
            app.shut_it_off = true;
            $.post(
                epoch_vars.api_url, {
                    action: 'comments_open',
                    epochNonce: epoch_vars.nonce,
                    postID: epoch_vars.post_id
                } ).fail( function( response  ) {
                    app.shut_it_off = false;
                } ).success( function( response ) {
                    response = app.get_data_from_response( response );
                    if ( true == response ) {
                        app.shut_it_off = false;
                    }else{
                        app.comments_closed = true;
                    }



                }
            );

        };


        /**
         * Get comment count
         *
         * @since 0.0.1
         *
         */
        app.comment_count = function( updateCheck ) {
                app.shut_it_off = true;
                $.post(
                    epoch_vars.api_url, {
                        action: 'comment_count',
                        epochNonce: epoch_vars.nonce,
                        postID: epoch_vars.post_id
                    } ).fail( function ( response ) {
                        app.shut_it_off = false;
                    } ).success( function ( response ) {
                        response = app.get_data_from_response( response );

                        if ( 'undefined' != response.count && 0 < response.count ) {
                            if ( updateCheck ) {
                                if ( response.count > app.last_count ) {
                                    app.new_comments();

                                }
                            }else{
                                app.get_comments();
                            }


                            app.last_count = response.count;

                        } else {
                            app.no_comments = true;
                        }

                        app.shut_it_off = false;
                    }
                );

        };

        /**
         * Get comments, use of inital load.
         *
         * @since 0.0.1
         */
        app.get_comments = function() {
            app.shut_it_off = true;

            $.post(
                epoch_vars.api_url, {
                    action: 'get_comments',
                    epochNonce: epoch_vars.nonce,
                    postID: epoch_vars.post_id,
                    highest: 0
                } ).done( function( response  ) {
                    app.shut_it_off = false;

                } ).success( function( response ) {
                    response = app.get_data_from_response( response );

                    app.comment_response( response, false );

                }

            );

        };

        /**
         * Takes response from get_comments & new_comment and parses them properly
         *
         * @since 0.0.11
         *
         * @param response
         */
        app.comment_response = function ( response, is_new ) {

            if ( 'object' == typeof response && 'undefined' != response && 'undefined' != response.comments ) {
                comments = response.comments;
                comments = JSON.parse( comments );
                depth = epoch_vars;


                if ( 'undefined' !== comments && 0 < comments.length ) {
                    $.each( comments, function ( key, comment ) {
                        id = parseInt( comment.comment_ID, 10 );
                        if ( app.highest_id < id ) {
                            app.highest_id = id;
                        }

                        //parse if comment isn't in the DOM already
                        if ( null == document.getElementById( 'comment-' + comment.comment_ID ) ) {
                            html = app.parse_comment( comment );
                            app.put_comment_in_dom( html, comment.comment_parent, comment.depth );

                            if ( is_new ) {
                                comment_el = document.getElementById( 'comment-' + comment.comment_ID );
                                if ( null != comment_el ) {
                                    $( comment_el ).addClass( 'epoch-success' ).delay( 2500 ).queue( function ( next ) {
                                        $( this ).removeClass( 'epoch-success' );
                                        next();
                                    } );

                                }
                            }

                            //parse its children if it has them and threaded comments is on
                            if ( 1 != depth ) {
                                parent_id = comment.comment_ID;
                                app.parse_children( comment, parent_id, 1 );

                            }
                        }

                    } );

                }

            }

        };

        /**
         * Get comments, use for getting new comments
         *
         * @since 0.0.11
         */
        app.new_comments = function() {
            app.shut_it_off = true;

            $.post(
                epoch_vars.api_url, {
                    action: 'new_comments',
                    epochNonce: epoch_vars.nonce,
                    postID: epoch_vars.post_id,
                    highest: app.highest_id
                } ).done( function( response  ) {

                    app.shut_it_off = false;

                } ).success( function( response ) {
                    response = app.get_data_from_response( response );

                    app.comment_response( response, true );


                }

            );

        };




        /**
         * Parse children of comment
         *
         * @since 0.0.4
         *
         * @param comment
         * @param parent_id
         */
        app.parse_children = function( comment, parent_id, level ) {

            if ( 'undefined' != comment ) {

                if (  false != comment.children  ) {

                    children = comment.children;
                    size = children.length;
                    if ( 0 != size ) {
                        for ( c = 0; c < size; c++ ) {
                            comment = children[ c ];

                            if ( null == document.getElementById( 'comment-' + comment.comment_ID ) ) {
                                pid = comment.comment_ID;
                                app.parse_comment( comment, level );
                                html = app.parse_comment( comment );
                                app.put_comment_in_dom( html, parent_id, comment.depth );
                            }


                            if ( false != comment.children ) {
                                level++;
                                if ( null == document.getElementById( 'comment-' + comment.comment_ID ) ) {
                                    app.parse_comment( comment );
                                    html = app.parse_comment( comment, pid, level );
                                }

                            }

                        }

                    }

                }

            }

        };

        /**
         * Utility function to get data key of responses.
         *
         * @since 0.0.1
         *
         * @param response
         * @returns {*}
         */
        app.get_data_from_response = function( response ) {
            return response.data;
        };

        /**
         * Parses content and outputs to DOM with the handlebars template
         *
         * @since 0.0.1
         *
         * @param comment Comment object
         */
        app.parse_comment = function( comment ) {
            parent_id = comment.comment_parent;
            source = $( app.template_el ).html();
            template = Handlebars.compile( source );
            html = template( comment );
            return html;
        };

        /**
         * Put a parse comment into the DOM
         *
         * @param html The actual HTML.
         * @param parent_id ID of parent, or 0 for top level comment.
         * @param level The threading level, not needed for top-level comments.
         */
        app.put_comment_in_dom = function( html, parent_id, level ) {
            if ( false == parent_id ) {
                $( html ).appendTo( app.comments_wrap_el );
            }else {
                html = '<div class="epoch-child child-of-' + parent_id +' level-' + level + ' ">' + html + '</div>';

                parent_el = document.getElementById( 'comment-' + parent_id );
                if ( null != parent_el) {
                    $( html ).appendTo(parent_el );
                } else {
                    $( html ).appendTo( app.comments_wrap_el );
                }

            }

            $( '.comment-reply-link' ).click( function( event ) {
                event.preventDefault;
            });
        };

        /**
         * Resize the epoch container based on content width
         *
         * @since 0.0.6
         */
        app.set_width = function() {
            el = document.getElementById( epoch_vars.sniffer );

            if ( null != el ) {
                content_width = $( el ).parent().parent().parent().parent().outerWidth();
                if ( 'number' == typeof content_width ) {
                    wrap_el = document.getElementById( epoch_vars.wrap_id );
                    $( wrap_el ).css( 'width', content_width );
                }

            }

        }



    })( jQuery, window.Epoch || ( window.Epoch = {} ) );

} );

jQuery( function () {
    Epoch.init();

} );

