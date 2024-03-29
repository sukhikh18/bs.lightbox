const Lightbox = (($) => {

    const NAME = 'lightbox'
    const JQUERY_NO_CONFLICT = $.fn[NAME]

    const __default = {
        doc: document,

        lang: 'ru',
        i18: {
            ru: {
                prev: 'Назад',
                next: 'Вперед',
                close : 'Закрыть',
                failLoad: 'Не удалось загрузить контент.',
                undefinedType: 'Не удалось определить тип контента',
            }
        },

        tpl: {
            title: 'Тестовый заголовок',
            preloader: '<div class="preloader"></div>',
            leftArrow: '<button type="button" title="{{prev}}"><span>&#10094;</span></button>',
            rightArrow: '<button type="button" title="{{next}}"><span>&#10095;</span></button>',
            close: '<button type="button" class="close" data-dismiss="modal" aria-label="{{close}}"><span aria-hidden="true">&times;</span></button>',
        },

        opts: {
            maxWidth: 9999,
            maxHeight: 9999,
            arrows: true,
            infinite: false,
            type: null,
            hideClose: true,
            deepPreload: 1,
        },

        onShow: () => {},
        onShown: () => {},
        onHide: () => {},
        onHidden: () => {},
        onNavigate: ( direction ) => {},
        onContentLoaded: () => {}
    }

    class Lightbox
    {
        static get Default() {
            return Default;
        }

        constructor($target, config) {
            this.config = $.extend({}, __default, config);
            this.$arrows = null;
            this.galleryIndex = 0;
            this.galleryName = null;
            // this._titleIsShown = false;
            // this._footerIsShown = false;
            this.remindLastWidth = 0;
            this.remindLastHeight = 0;

            this.modalId = 'modal-' + Math.floor((Math.random() * 1000) + 1); // this.config.id ||

            this.header = this.config.tpl.close; // || '<div class="modal-header"><h5 class="mb-0">' + this.config.tpl.title + '</h5>' + this.config.tpl.close + '</div>';
            this.footer = ' ' || '<div class="modal-footer"></div>';

            this.tpl =
                '<div class="modal lightbox fade" id="'+ this.modalId +'" tabindex="-1" role="dialog" aria-hidden="true">'
              + '   <div class="modal-dialog" role="document">' // modal-dialog-centered
              + '       <div class="modal-content">'
              + '           ' + this.translate( this.header )
              + '           <div class="modal-body">'
              + '               <div class="modal-container">'
              + '                   <div class="modal-item fade in show"></div>'
              + '                   <div class="modal-item fade"></div>'
              + '               </div>'
              + '           </div>'
              + '           ' + this.translate( this.footer )
              + '       </div><!-- .modal-content -->'
              + '   </div>'
              + '</div>';

            // append modal to document
            $(this.config.doc.body).append( this.tpl );
            // this target element
            this.$element = $target instanceof jQuery ? $target : $($target);
            // modal group ID
            this.galleryName = this.$element.data('gallery');
            // this modal element
            this.$modal = $('#' + this.modalId, this.config.doc);
            // animated block
            this.$dialog = $('.modal-dialog', this.$modal);
            // container closest modal
            this.$container = $('.modal-container', this.$modal);
            // container closest modal
            this.$body = $('.modal-body', this.$modal);
            this.$content = $('.modal-content', this.$modal);

            this._border = this._calculateBorders(); // call after append and element defined
            this._padding = this._calculatePadding(); // call after append and element defined

            // check any nodes with this gallery name
            if (this.galleryName) {
                // get all gallery trigger items
                this.$items = $(document.body).find('[data-gallery="' + this.galleryName + '"]');
                // this element current position
                this.galleryIndex = this.$items.index(this.$element);
                // set hotkeys on lightbox
                $(document).on('keydown.bs.lightbox', this._hotkeys.bind(this))
                // add the directional arrows to the modal
                if (this.config.opts.arrows && !this.isSingle()) {
                    // insert (if)required arrows
                    this._arrows();
                }
            }

            this.$modal.addClass(this.isTouchDevice() ? 'touch' : 'no-touch');

            this._arrowEvents();
            this._modalEvents();
            // this._touchEvents();
        }

        _modalEvents() {
            /**
             * Set the events
             * and call bootstrap modal
             */
            this.$modal
                // call onShow on modal open
                .on('show.bs.modal', this.config.onShow.bind(this))
                // call onShown after modal opened
                .on('shown.bs.modal', () => {
                    this.toggleLoading(true);
                    this.open();
                    return this.config.onShown.call(this);
                })
                // call onHide on modal close
                .on('hide.bs.modal', this.config.onHide.bind(this))
                // Call onHidden after modal closed
                .on('hidden.bs.modal', () => {
                    if (this.galleryName) {
                        $(document).off('keydown.bs.lightbox')
                        $(window).off('resize.bs.lightbox')
                    }
                    // jQuery element delete
                    this.$modal.remove();
                    return this.config.onHidden.call(this);
                })
                .modal(this.config);

            $(window).on('resize.bs.lightbox', () => {
                this._resize(this.remindLastWidth, this.remindLastHeight)
            });
        }

        getLangString(stringKey) {
            let langArr = this.config.i18[ this.config.lang ] || this.config.i18.ru;

            if( langArr[ stringKey ] ) {
                return langArr[ stringKey ];
            }

            return stringKey
                // insert a space before all caps
                .replace(/([A-Z])/g, ' $1')
                .toLowerCase()
                // uppercase the first character
                .replace(/^./, function(str) { return str.toUpperCase(); })
        }

        translate(str) {
            return str.replace(/\{\{(\w+)\}\}/g, (match, n1) => {
                return this.getLangString(n1);
            });
        }

        error(message, subMessage) {
            message = getLangString(message);

            if( subMessage ) {
                message+= ': ' + subMessage;
            }

            console.error(message);
            this._containerToUse().html(message);
            this._resize(500, 180);
            return this;
        }

        isSingle() {
            return !this.$items || this.$items.length === 1;
        }

        isImage(string) {
            return string && string.match(/(^data:image\/.*,)|(\.(jp(e|g|eg)|gif|png|bmp|webp|svg)((\?|#).*)?$)/i)
        }

        isMedia(string) {
            return string && string.match(/(\.(mp3|mp4|ogg|webm|wav)((\?|#).*)?$)/i)
        }

        isExternal(url) {
            let match = url.match(/^([^:\/?#]+:)?(?:\/\/([^\/?#]*))?([^?#]+)?(\?[^#]*)?(#.*)?/);
            if (typeof match[1] === "string" && match[1].length > 0 && match[1].toLowerCase() !== location.protocol)
                return true;

            if (typeof match[2] === "string" && match[2].length > 0 && match[2].replace(new RegExp(`:(${{
                    "http:": 80,
                    "https:": 443
                }[location.protocol]})?$`), "") !== location.host)
                return true;

            return false;
        }

        // @todo
        isSelector() {
        }

        /****************************** Guestures *****************************/
        isTouchDevice() {
            var prefixes = ' -webkit- -moz- -o- -ms- '.split(' ');
            var mq = function(query) {
                return window.matchMedia(query).matches;
            }

            if (('ontouchstart' in window) || window.DocumentTouch && document instanceof DocumentTouch) {
                return true;
            }

            // include the 'heartz' as a way to have a non matching MQ to help terminate the join
            // https://git.io/vznFH
            var query = ['(', prefixes.join('touch-enabled),('), 'heartz', ')'].join('');
            return mq(query);
        }

        // _touchEvents() {
        //     let isTouch = this.isTouchDevice();

        //     this.touch = {
        //         data: {},
        //         start: {},
        //         stop: {},
        //         event: {
        //             scroll: "touchmove scroll",
        //             start: isTouch ? "touchstart" : "mousedown",
        //             stop:  isTouch ? "touchend" : "mouseup",
        //             move:  isTouch ? "touchmove" : "mousemove",
        //         }
        //     }

        //     var self = this;
        //     var isVertical = false;
        //     var isHorizontal = false;

        //     /**
        //      * Guestures events
        //      */
        //     this.$dialog
        //         .on(this.touch.event.start, (event) => {
        //             // event data
        //             this.touch.data = event.originalEvent.touches ?
        //                 event.originalEvent.touches[ 0 ] :
        //                 event;
        //             // start data
        //             this.touch.start = [ this.touch.data.pageX, this.touch.data.pageY ];
        //             // origin: $(event.target)
        //         })
        //         // move object in touch
        //         .on(this.touch.event.move, (event) => {
        //             if (!this.touch.start) return;
        //             // update data
        //             this.touch.data = event.originalEvent.touches ? event.originalEvent.touches[ 0 ] : event;
        //             this.touch.stop = [ this.touch.data.pageX, this.touch.data.pageY ];
        //             // prevent scrolling
        //             // @TODO check this clicable elements (as a or button)
        //             event.preventDefault();

        //             if (Math.abs(this.touch.start[0] - this.touch.stop[0]) > 10) {
        //                 if( this.$arrows ) {
        //                     $('button', this.$arrows)
        //                         .addClass('disabled')
        //                         .attr('disabled', 'disabled');
        //                 }

        //                 if( !this.isSingle() ) {
        //                     this.$container
        //                         .addClass('touched')
        //                         .addClass('touched-horizontal');


        //                     return this.horizontalMove();
        //                 }
        //                 else {
        //                     // _touchStop(event);
        //                 }
        //             }

        //             if(Math.abs(this.touch.start[1] - this.touch.stop[1]) > 10) {
        //                 if( this.$arrows ) {
        //                     $('button', this.$arrows)
        //                         .addClass('disabled')
        //                         .attr('disabled', 'disabled');
        //                 }

        //                 this.$container
        //                     .addClass('touched')
        //                     .addClass('touched-vertical');

        //                 return this.verticalMove();
        //             }
        //         })

        //     // call stop on touch end\mouse up
        //     $(document).on(this.touch.event.stop, this.$dialog, (event) => {
        //         // reset move event
        //         // this.$dialog.unbind(this.touch.event.move, this._touch);
        //         // data exists
        //         if (this.touch.start[0] !== undefined && this.touch.stop[0] !== undefined) {
        //             if( isHorizontal ) {
        //                 horizontalMoveEnd();
        //             }

        //             // is vertical move stop
        //             if( isVertical ) {
        //                 verticalMoveEnd();
        //             }
        //             else {
        //                 this.$dialog.css('transform', 'translate(0, 0)');
        //             }
        //         }

        //         var $container = this.$container;

        //         // disable after click event (for arrows disabled)
        //         setTimeout(function() {
        //             $container
        //                 .removeClass('touched')
        //                 .removeClass('touched-vertical')
        //                 .removeClass('touched-horizontal');
        //         }, 100);

        //         self.touch.start = [];
        //         self.touch.stop = [];
        //         // isVertical = false;
        //         // isHorizontal = false;
        //         self._navigateUpdate();
        //     });
        //     // $(document).on('mouseleave', this.$dialog, this._touchStop);
        // }

        // verticalMove() {
        //     // if( !!isHorizontal ) return;
        //     // isVertical = true;

        //     this.$dialog.css({
        //         'transform': 'translateY(' + -(this.touch.start[1] - this.touch.data.pageY) + 'px)',
        //         'transition': 'none'
        //     });
        // }

        // verticalMoveEnd() {
        //     if ( Math.abs(this.touch.start[1] - this.touch.stop[1]) > 30 ) {
        //         this.$dialog.css('transition', '');
        //         this.$modal.modal('hide');
        //     }
        //     else {
        //         this.$dialog.css('transform', 'translate(0, 0)');
        //     }
        // }

        // horizontalMove() {
        //     // if( !!isVertical ) return;
        //     // isHorizontal = true;

        //     this.$dialog.css({
        //         'transform': 'translateX(' + -(this.touch.start[0] - this.touch.data.pageX) + 'px)',
        //         'transition': 'none'
        //     });
        // }

        // horizontalMoveEnd() {
        //     if ( Math.abs(this.touch.start[0] - this.touch.stop[0]) > 30 ) {
        //         if( this.touch.start[0] > this.touch.stop[0] ) {
        //             this.navigateRight();
        //         }
        //         else {
        //             this.navigateLeft();
        //         }
        //     }
        // }

        open() {
            let $toUse = this._containerToUse()
            // this._updateTitleAndFooter()

            let remote = this.$element.attr('data-remote') || this.$element.attr('href');
            let type = this.detectRemoteType(remote, this.$element.attr('data-type') || false)

            if(['image', 'youtube', 'vimeo', 'instagram', 'media', 'url'].indexOf(type) < 0)
                return this.error( 'undefinedType' )

            switch(type) {
                case 'image':
                    this._preloadImage(remote, $toUse)
                    this._preloadNearImages(this.galleryIndex, this.config.opts.deepPreload)
                    break;

                case 'youtube':
                    this.showYoutubeVideo(remote, $toUse);
                    break;

                case 'vimeo':
                    this.showVimeoVideo(this.getVimeoId(remote), $toUse);
                    break;

                case 'instagram':
                    this.showInstagramVideo(this.getInstagramId(remote), $toUse);
                    break;

                case 'media':
                    this.showHtml5Media(remote, $toUse);
                    break;

                default: // url
                    this.loadRemoteContent(remote, $toUse);
                    break;
            }

            return this;
        }

        close() {
            return this.$modal.modal('hide');
        }

        /****************************** Controlls *****************************/
        toggleLoading(show) {
            if(!!show) {
                this.$dialog.css('display', 'none');
                this.$modal.removeClass('in show');
                $('.modal-backdrop').append( this.translate(this.config.tpl.preloader) );
            }
            else {
                this.$dialog.css('display', 'block');
                this.$modal.addClass('in show');
                $('.modal-backdrop').find('.preloader').remove();
            }
            return this;
        }

        navigateTo(index) {
            if(this.isSingle()) return;
            // outer offset
            if (index < 0 || index > this.$items.length - 1) return;
            // change current index
            this.galleryIndex = index;
            // chenge active element
            this.$element = $(this.$items.get(this.galleryIndex));

            this._navigateUpdate()
            return this.open();
        }

        navigateLeft() {
            // not has many items
            if( !this.$items || this.$items.length === 1 ) return;

            // rewind index
            if (this.galleryIndex === 0) {
                if (this.config.opts.infinite) this.galleryIndex = this.$items.length - 1;
                else return;
            }
            else {
                this.galleryIndex--;
            }

            // call event
            this.config.onNavigate.call(this, 'left', this.galleryIndex)
            return this.navigateTo(this.galleryIndex)
        }

        navigateRight() {
            // not has many items
            if( !this.$items || this.$items.length === 1 ) return;

            if (this.galleryIndex === this.$items.length - 1) {
                if (this.config.opts.infinite) this.galleryIndex = 0;
                else return;
            }
            else {
                this.galleryIndex++;
            }

            this.config.onNavigate.call(this, 'right', this.galleryIndex)
            return this.navigateTo(this.galleryIndex)
        }

        _hotkeys(event) {
            event = event || window.event;
            let key = event.keyCode || event.which;
            // right arrow or space
            if (key === 39 || key === 32) {
                return this.navigateRight();
            }
            // left arrow or backspace
            if (key === 37 || key === 8) {
                return this.navigateLeft();
            }
            // escape
            if (key === 27) {
                return this.close();
            }
        }

        _arrows() {
            this.$container.append('<div class="navigations">'
                + this.translate(this.config.tpl.leftArrow)
                + this.translate(this.config.tpl.rightArrow)
                + '</div>');

            this.$arrows = $('.navigations', this.$container);
        }

        _arrowEvents() {
            if( !this.$arrows ) return;

            this.$arrows.on('click', 'button:first-child', event => {
                if( !this.$container.hasClass('touched') ) {
                    event.preventDefault();
                    return this.navigateLeft();
                }
            });

            this.$arrows.on('click', 'button:last-child', event => {
                if( !this.$container.hasClass('touched') ) {
                    event.preventDefault();
                    return this.navigateRight();
                }
            });

            this._navigateUpdate();
        }

        _navigateUpdate() {
            if (!this.config.opts.infinite && this.$arrows) {
                if (this.galleryIndex === 0) {
                    $('button:first-child', this.$arrows)
                        .addClass('disabled')
                        .attr('disabled', 'disabled');
                }
                else {
                    $('button:first-child', this.$arrows)
                        .removeClass('disabled')
                        .removeAttr('disabled');
                }

                if (this.galleryIndex === this.$items.length - 1) {
                    $('button:last-child', this.$arrows)
                        .addClass('disabled')
                        .attr('disabled', 'disabled');
                }
                else {
                    $('button:last-child', this.$arrows)
                        .removeClass('disabled')
                        .removeAttr('disabled');
                }
            }
        }

        toggleArrows(show) {
            if( this.$arrows ) {
                if(!!show) return this.$arrows.css('display', '');
                else return this.$arrows.css('display', 'none');
            }
        }

        /**************************** Layout tools ****************************/
        // serve container
        _containerToUse() {
            let $first = this.$container.children('.modal-item:first');
            let $last = this.$container.children('.modal-item:last');

            // if currently showing an image, fade it out and remove
            let $toUse = $last;
            let $current = $first;

            if($toUse.hasClass('in')) {
                $toUse = $first;
                $current = $last;
            }

            $current.removeClass('in show');
            setTimeout(() => {
                if(!$last.hasClass('in')) $last.empty()
                if(!$first.hasClass('in')) $first.empty()
            }, 500);

            $toUse.addClass('in show');
            return $toUse;
        }
        // load in container
        _preloadImage(src, $containerForImage) {
            $containerForImage = $containerForImage || false

            let img = new Image();
            if ($containerForImage) {
                // if loading takes > 200ms show a loader
                let loadingTimeout = setTimeout(() => {
                    $containerForImage.append( this.translate(this.config.tpl.preloader) )
                }, 200)

                img.onload = () => {
                    if(loadingTimeout) clearTimeout(loadingTimeout)

                    let image = $('<img />', {
                        src: img.src,
                        class: 'img-fluid'
                    });

                    $containerForImage.html(image);
                    if( this.$arrows ) {
                        this.$arrows.css('display', '') // remove display to default to css property
                    }

                    this._resize(img.width, img.height);
                    this.toggleLoading(false);
                    return this.config.onContentLoaded.call(this);
                };

                img.onerror = () => {
                    this.toggleLoading(false);
                    return this.error('failLoad', + src);
                };
            }

            img.src = src;
            return img;
        }
        // preload near images
        // @todo repair this
        _preloadNearImages(index, deep, depth = 1) {
            if(this.isSingle()) return;

            let nextItem = $(this.$items.get(index + depth), false);
            if('undefined' != typeof nextItem) {
                let src = nextItem.attr('data-remote') || nextItem.attr('href');
                // if ('image' === nextItem.attr('data-type') || this.isImage(src));
                // this._preloadImage(src, false);
            }

            let prevItem = $(this.$items.get(index - depth), false);
            if('undefined' != typeof prevItem) {
                let src = prevItem.attr('data-remote') || prevItem.attr('href');
                // if ('image' === prevItem.attr('data-type') || this.isImage(src));
                // this._preloadImage(src, false);
            }

            if(deep > 1) {
                return this._preloadNearImages(index, --deep, ++depth);
            }
        }

        _totalCssByAttribute(attribute) {
            return parseInt(this.$dialog.css(attribute), 10) +
                parseInt(this.$content.css(attribute), 10) +
                parseInt(this.$body.css(attribute), 10)
        }

        _calculateBorders() {
            return {
                top: this._totalCssByAttribute('border-top-width'),
                right: this._totalCssByAttribute('border-right-width'),
                bottom: this._totalCssByAttribute('border-bottom-width'),
                left: this._totalCssByAttribute('border-left-width'),
            }
        }

        _calculatePadding() {
            return {
                top: this._totalCssByAttribute('padding-top'),
                right: this._totalCssByAttribute('padding-right'),
                bottom: this._totalCssByAttribute('padding-bottom'),
                left: this._totalCssByAttribute('padding-left'),
            }
        }

        _resize(width, height) {

            if( "object" == typeof width ) {
                height = width.height;
                width = width.width;
            }

            height = height || width
            this.remindLastWidth = width
            this.remindLastHeight = height

            let imageAspecRatio = width / height;

            // if width > the available space, scale down the expected width and height
            let gutterHorizontal = this._padding.left + this._padding.right + this._border.left + this._border.right
            let gutterVertical = this._padding.top + this._padding.bottom + this._border.bottom + this._border.top

            // force 10px margin if window size > 575px
            let discountMargin = this.config.doc.body.clientWidth > 575 ? 0 : 20

            //calculated each time as resizing the window can cause them to change due to Bootstraps fluid margins
            let margins = parseFloat(this.$dialog.css('margin-top')) + parseFloat(this.$dialog.css('margin-bottom'));

            let headerHeight = 0,
                footerHeight = 0

            // as the resize is performed the modal is show, the calculate might fail
            // if so, default to the default sizes
            // if (this._footerIsShown)
            // footerHeight = this._$modalFooter.outerHeight(true) || 55

            // if (this._titleIsShown)
            // headerHeight = this._$modalHeader.outerHeight(true) || 67

            let maxWidth = Math.min(width + gutterHorizontal,
                this.config.doc.body.clientWidth,
                this.config.opts.maxWidth
            );

            if((width + gutterHorizontal) > maxWidth) {
                height = (maxWidth - gutterHorizontal - discountMargin) / imageAspecRatio;
                width = maxWidth
            }
            else {
                width = (width + gutterHorizontal)
            }

            let maxHeight = Math.min(height,
                $(window).height() - gutterVertical - margins - headerHeight - footerHeight,
                this.config.opts.maxHeight - gutterVertical - headerHeight - footerHeight
            );

            if(height > maxHeight) {
                // if height > the available height, scale down the width
                width = Math.ceil(maxHeight * imageAspecRatio) + gutterHorizontal;
            }

            this.$container.css('height', maxHeight)
            this.$dialog.css('flex', 1).css('max-width', width);

            let modal = this.$modal.data('bs.modal');
            if (modal) modal.handleUpdate();

            return this;
        }

        getElementSize() {
            let width = this.$element.data('width') || 560;

            return {
                width: width,
                height: this.$element.data('height') || width / 100 * 56.25
            }
        }

        /************************** Type check tools **************************/
        detectRemoteType(src, type) {
            type = type || false;

            if(!type && this.isImage(src)) type = 'image';
            if(!type && this.getYoutubeId(src)) type = 'youtube';
            if(!type && this.getVimeoId(src)) type = 'vimeo';
            if(!type && this.getInstagramId(src)) type = 'instagram';
            if(type == 'audio' || type == 'video' || (!type && this.isMedia(src))) type = 'media';
            if(!type || ['image', 'youtube', 'vimeo', 'instagram', 'media', 'url'].indexOf(type) < 0)
                type = 'url';

            return type;
        }

        getRemoteContentType(src) {
            let response = $.ajax({
                type: 'HEAD',
                url: src,
                async: false
            });
            let contentType = response.getResponseHeader('Content-Type')
            return contentType;
        }

        // should be used for videos only. for remote content use loadRemoteContent (data-type=url)
        showHtml5Media(url, $containerForElement) {
            let contentType = this.getRemoteContentType(url);
            if(!contentType) return this.error( this.getLangString('undefinedType') )

            let mediaType = contentType.indexOf('audio') > 0 ? 'audio' : 'video',
                size = this.getElementSize();

            $containerForElement.html( $('<div class="embed-responsive embed-responsive-16by9"></div>').append(
                $('<' + mediaType + '>', {
                    class: 'embed-responsive-item',
                    // width: size.width,
                    // height: size.height,
                    preload: 'auto',
                    autoplay: 1,
                    controls: 1
                })
                .append('<source src="' + url + '" type="' + contentType + '">')
                .append( this.getLangString('undefinedType') )
            ) );

            this._resize(size.width, size.height);
            this.config.onContentLoaded.call(this);
            // hide the arrows when showing video
            this.toggleArrows(false);
            this.toggleLoading(false);
            return this;
        }

        // should be used for videos only. for remote content use loadRemoteContent (data-type=url)
        showVideoIframe(url, $containerForElement, size, wrapClass = 'embed-responsive embed-responsive-16by9') {
            if( !size ) size = this.getElementSize();

            let $iFrame = $('<iframe>', {
                src: url,
                class: 'embed-responsive-item',
                width: size.width,
                height: size.height,
                frameborder: 0,
                allowfullscreen: 1,
            });

            if( !!wrapClass ) {
                $containerForElement.html(
                    $('<div class="' + wrapClass + '"></div>')
                        .append( $iFrame )
                );
            }
            else {
                $containerForElement.html( $iFrame );
            }

            this._resize(size.width, size.height);
            this.config.onContentLoaded.call(this);
            // hide the arrows when showing video
            this.toggleArrows(false);
            this.toggleLoading(false);
            return this;
        }

        getYoutubeId(string) {
            if(!string)
                return false;
            let matches = string.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/)
            return (matches && matches[2].length === 11) ? matches[2] : false
        }

        showYoutubeVideo(remote, $containerForElement) {
            let id = this.getYoutubeId(remote)
            let query = remote.indexOf('&') > 0 ? remote.substr(remote.indexOf('&')) : ''

            return this.showVideoIframe(
                `//www.youtube.com/embed/${id}?badge=0&autoplay=1&html5=1${query}`,
                $containerForElement
            );
        }

        getVimeoId(string) {
            return string && string.indexOf('vimeo') > 0 ? string : false
        }

        showVimeoVideo(id, $containerForElement) {
            return this.showVideoIframe(id + '?autoplay=1', $containerForElement)
        }

        getInstagramId(string) {
            return string && string.indexOf('instagram') > 0 ? string : false
        }

        showInstagramVideo(id, $containerForElement) {
            // instagram load their content into iframe's so this can be put straight into the element
            let width = this.$element.data('width') || 612
            let height = width + 80;
            id = id.substr(-1) !== '/' ? id + '/' : id; // ensure id has trailing slash

            return this.showVideoIframe(
                id + 'embed/',
                $containerForElement,
                {width: width, height: height},
                null
            );
        }

        loadRemoteContent(url, $containerForElement) {
            let disableExternalCheck = this.$element.data('disableExternalCheck') || false;
            this.toggleLoading(false);

            // external urls are loading into an iframe
            // local ajax can be loaded into the container itself
            if (!disableExternalCheck && !this.isExternal(url)) {
                $containerForElement.load(url, $.proxy(() => {
                    return this.$element.trigger('loaded.bs.modal');
                }));

            } else {
                $containerForElement.html(`<iframe src="${url}" frameborder="0" allowfullscreen></iframe>`);
                this.config.onContentLoaded.call(this);
            }

            // hide the arrows when remote content
            this.toggleArrows(false);
            this._resize( this.getElementSize() );
            return this;
        }

        static _jQueryInterface(config) {
            config = config || {}
            return this.each(() => {
                let $this = $(this)
                let config = $.extend({}, Lightbox.__default, $this.data(), typeof config === 'object' && config )

                new Lightbox(this, config)
            })
        }
    }

    $.fn[NAME]             = Lightbox._jQueryInterface;
    $.fn[NAME].Constructor = Lightbox;
    $.fn[NAME].noConflict  = () => {
        $.fn[NAME] = JQUERY_NO_CONFLICT;
        return Lightbox._jQueryInterface;
    }

    return Lightbox

})(jQuery)

export default Lightbox
