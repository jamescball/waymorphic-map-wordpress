/**
 * Waymorphic Map: turns each element with a data-waymorphic-map attribute
 * into a MapLibre map. The block editor uses WaymorphicMap.create() too.
 */
( function () {
	'use strict';

	var MARKER_COLOUR = '#1f6feb';
	var text = window.waymorphicMapL10n || {};

	/**
	 * Puts values in a text: %s and %d in sequence, or %1$s and %2$d by number.
	 */
	function fill( template, values ) {
		var next = 0;
		return String( template ).replace( /%(?:(\d+)\$)?[sd]/g, function ( all, number ) {
			return values[ number ? number - 1 : next++ ];
		} );
	}

	function escapeHtml( value ) {
		var node = document.createElement( 'div' );
		node.textContent = value;
		return node.innerHTML;
	}

	var HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

	/**
	 * Tells if an address is safe in a link or a picture: http and https, and
	 * for a link also mailto and tel. Not javascript: or data:.
	 */
	function safeUrl( value, link ) {
		try {
			var protocol = new window.URL( String( value ), document.baseURI ).protocol;
			return protocol === 'http:' || protocol === 'https:' || ( !! link && ( protocol === 'mailto:' || protocol === 'tel:' ) );
		} catch ( error ) {
			return false;
		}
	}

	// The elements and the attributes that the HTML of a popup can have.
	var POPUP_TAGS = /^(?:A|ABBR|ADDRESS|ARTICLE|ASIDE|AUDIO|B|BDI|BDO|BIG|BLOCKQUOTE|BR|CAPTION|CITE|CODE|COL|COLGROUP|DD|DEL|DETAILS|DFN|DIV|DL|DT|EM|FIGCAPTION|FIGURE|FOOTER|H1|H2|H3|H4|H5|H6|HEADER|HR|I|IMG|INS|KBD|LI|MARK|OL|P|PICTURE|PRE|Q|S|SECTION|SMALL|SOURCE|SPAN|STRIKE|STRONG|SUB|SUMMARY|SUP|TABLE|TBODY|TD|TFOOT|TH|THEAD|TIME|TR|U|UL|VAR|VIDEO|WBR)$/;
	// These elements go, with all that is in them.
	var POPUP_REMOVE = /^(?:SCRIPT|STYLE|IFRAME|FRAME|FRAMESET|OBJECT|EMBED|APPLET|TEMPLATE|NOSCRIPT|TITLE|HEAD|META|LINK|BASE|FORM|INPUT|BUTTON|SELECT|OPTION|TEXTAREA|CANVAS|DIALOG|MAP|AREA|SLOT)$/;
	var POPUP_ATTRIBUTES = /^(?:href|src|srcset|sizes|alt|title|class|style|width|height|colspan|rowspan|scope|target|rel|lang|dir|controls|loop|muted|poster|preload|loading|decoding|datetime|cite|start|reversed|type|open|hreflang|align|valign|role|aria-[a-z]+)$/;

	function copyClean( from, to, depth ) {
		Array.prototype.forEach.call( from.childNodes, function ( node ) {
			if ( node.nodeType === 3 ) {
				to.appendChild( document.createTextNode( node.nodeValue ) );
				return;
			}
			// No SVG and no MathML: only HTML elements.
			if ( node.nodeType !== 1 || node.namespaceURI !== 'http://www.w3.org/1999/xhtml' || POPUP_REMOVE.test( node.nodeName ) || depth > 100 ) {
				return;
			}
			if ( ! POPUP_TAGS.test( node.nodeName ) ) {
				// An element that is not in the list: keep its text.
				copyClean( node, to, depth + 1 );
				return;
			}
			var element = document.createElement( node.nodeName );
			Array.prototype.forEach.call( node.attributes, function ( attribute ) {
				var name = attribute.name.toLowerCase();
				var value = attribute.value;
				if ( ! POPUP_ATTRIBUTES.test( name ) ) {
					return;
				}
				if ( ( name === 'href' || name === 'cite' ) && ! safeUrl( value, true ) ) {
					return;
				}
				if ( ( name === 'src' || name === 'poster' ) && ! safeUrl( value, false ) ) {
					return;
				}
				if (
					name === 'srcset' &&
					! value.split( ',' ).every( function ( part ) {
						return safeUrl( part.trim().split( /\s+/ )[ 0 ], false );
					} )
				) {
					return;
				}
				element.setAttribute( name, value );
			} );
			if ( element.hasAttribute( 'target' ) ) {
				// A page that opens in a new tab gets no access to this page.
				element.setAttribute( 'rel', 'noopener' );
			}
			copyClean( node, element, depth + 1 );
			to.appendChild( element );
		} );
	}

	/**
	 * Makes safe nodes from the HTML of a popup. The server cleans the HTML of
	 * the popups (wp_kses_post). The script cleans it again, because the
	 * configuration of a map can also come from an element that a writer puts
	 * in the content of a post: that HTML must not run scripts.
	 *
	 * @param {string} html The HTML.
	 * @return {DocumentFragment} Elements and text. No scripts, no event attributes, no javascript: addresses.
	 */
	function cleanHtml( html ) {
		var fragment = document.createDocumentFragment();
		html = String( html || '' );
		if ( ! /[<&]/.test( html ) ) {
			// Text with no element and no character reference: the parser is not necessary.
			if ( html ) {
				fragment.appendChild( document.createTextNode( html ) );
			}
			return fragment;
		}
		// The parser makes a document that runs nothing.
		copyClean( new window.DOMParser().parseFromString( '<body>' + html, 'text/html' ).body, fragment, 0 );
		return fragment;
	}

	// The popup is not wider than the map.
	var POPUP_WIDTH = 'min(260px, calc(100% - 20px))';

	/**
	 * Adds the credit of the map (the names and links at the bottom right).
	 * The text of the credit comes from the tile server, and MapLibre writes it
	 * in the page as HTML. Its cleaning of that HTML has a fault in the version
	 * that the plugin includes (GHSA-jrc7-96c5-q579): a tile server could run a
	 * script in the page. Thus the plugin cleans the text before MapLibre reads
	 * it, with the list of safe elements that it uses for the popups.
	 *
	 * The map must be made with attributionControl: false. The functions of this
	 * control must listen to the map before the credit of MapLibre does.
	 *
	 * @param {Object} map The MapLibre map.
	 * @param {Object} gl  The MapLibre library of the window of the map.
	 */
	function addCredit( map, gl ) {
		function clean( source ) {
			if ( ! source || typeof source.attribution !== 'string' || source.attribution === source.waymorphicCredit ) {
				return;
			}
			var holder = document.createElement( 'div' );
			holder.appendChild( cleanHtml( source.attribution ) );
			source.attribution = holder.innerHTML;
			source.waymorphicCredit = source.attribution;
		}
		function cleanAll() {
			var sources = {};
			try {
				sources = ( map.getStyle() || {} ).sources || {};
			} catch ( error ) {
				// The style is not there yet.
			}
			Object.keys( sources ).forEach( function ( id ) {
				clean( map.getSource( id ) );
			} );
		}
		map.on( 'styledata', cleanAll );
		map.on( 'sourcedata', function ( event ) {
			// The credit of a source comes with its description.
			if ( event.sourceDataType === 'metadata' || event.sourceDataType === 'visibility' ) {
				clean( event.sourceId ? map.getSource( event.sourceId ) : null );
				cleanAll();
			}
		} );
		cleanAll();
		map.addControl( new gl.AttributionControl( { compact: true, customAttribution: '<a href="https://maplibre.org/" target="_blank">MapLibre</a>' } ) );
	}

	/**
	 * The map services of the directions link: objects with label and url. In
	 * a url, ~lat~ and ~lng~ are the position of the marker.
	 */
	function directionsServices( config ) {
		if ( ! config ) {
			return [];
		}
		if ( Array.isArray( config.directions ) ) {
			return config.directions.filter( function ( service ) {
				return service && typeof service.url === 'string' && /^https?:\/\//i.test( service.url );
			} );
		}
		// The configuration of version 1.1 had one address.
		return /^https?:\/\//i.test( config.directionsUrl || '' ) ? [ { label: '', url: String( config.directionsUrl ) } ] : [];
	}

	function serviceLink( service, item, className, words ) {
		var link = document.createElement( 'a' );
		link.className = className;
		link.href = service.url.replace( /~lat~/g, item.lat ).replace( /~lng~/g, item.lng );
		link.target = '_blank';
		link.rel = 'noopener';
		link.textContent = words;
		return link;
	}

	// The list of map services that shows, or null. One list shows at a time.
	var openMenu = null;
	var menuCount = 0;

	function closeMenu( focus ) {
		var menu = openMenu;
		openMenu = null;
		if ( menu ) {
			menu.close( focus );
		}
	}

	document.addEventListener(
		'pointerdown',
		function ( event ) {
			if ( openMenu && ! openMenu.wrap.contains( event.target ) ) {
				closeMenu();
			}
		},
		true
	);
	// A list that shows above the page does not move with the page: put it at its button again.
	function moveMenu() {
		if ( openMenu && openMenu.above ) {
			openMenu.place();
		}
	}
	window.addEventListener( 'resize', moveMenu );
	document.addEventListener( 'scroll', moveMenu, true );

	/**
	 * A "Directions" button that shows the list of the map services. The
	 * visitor selects one.
	 */
	function directionsMenu( services, item, label ) {
		var wrap = document.createElement( 'span' );
		wrap.className = 'waymorphic-map__choice';

		var button = document.createElement( 'button' );
		button.type = 'button';
		button.className = 'waymorphic-map__directions waymorphic-map__directions--menu';
		button.textContent = text.directions || 'Directions';
		button.setAttribute( 'aria-label', label );
		button.setAttribute( 'aria-expanded', 'false' );

		var menu = document.createElement( 'span' );
		menu.className = 'waymorphic-map__menu';
		menu.id = 'waymorphic-map-menu-' + ++menuCount;
		menu.setAttribute( 'role', 'group' );
		menu.setAttribute( 'aria-label', text.directionsIn || 'Open the directions in' );
		button.setAttribute( 'aria-controls', menu.id );
		services.forEach( function ( service ) {
			var words = String( service.label || service.url );
			var link = serviceLink( service, item, 'waymorphic-map__menu-item', words );
			link.setAttribute( 'aria-label', fill( text.newTab || '%s (opens in a new tab)', [ words ] ) );
			menu.appendChild( link );
		} );

		// A popover shows above all the page: the list and the map do not cut it.
		// A browser that has no popovers shows the services below the button.
		var api = { wrap: wrap, above: typeof menu.showPopover === 'function' };
		if ( api.above ) {
			menu.setAttribute( 'popover', 'manual' );
		}

		// Below the button, or above it when there is no space below.
		api.place = function () {
			var at = button.getBoundingClientRect();
			var page = document.documentElement;
			var list = button.closest( '.waymorphic-map__list' );
			var frame = list ? list.getBoundingClientRect() : { top: 0, bottom: page.clientHeight };
			if ( at.bottom < Math.max( 0, frame.top ) || at.top > Math.min( page.clientHeight, frame.bottom ) ) {
				// The button went out of view.
				closeMenu();
				return;
			}
			var width = menu.offsetWidth;
			var height = menu.offsetHeight;
			var left = window.getComputedStyle( button ).direction === 'rtl' ? at.left : at.right - width;
			var top = at.bottom + 4;
			if ( top + height > page.clientHeight - 8 && at.top - height - 4 >= 8 ) {
				top = at.top - height - 4;
			}
			menu.style.left = Math.max( 8, Math.min( left, page.clientWidth - width - 8 ) ) + 'px';
			menu.style.top = top + 'px';
		};

		api.close = function ( focus ) {
			menu.classList.remove( 'is-open' );
			if ( api.above ) {
				try {
					menu.hidePopover();
				} catch ( error ) {
					// The list is not in the page now.
				}
			}
			button.setAttribute( 'aria-expanded', 'false' );
			if ( focus ) {
				button.focus();
			}
		};

		button.addEventListener( 'click', function () {
			if ( openMenu === api ) {
				closeMenu();
				return;
			}
			closeMenu();
			menu.classList.add( 'is-open' );
			button.setAttribute( 'aria-expanded', 'true' );
			openMenu = api;
			if ( api.above ) {
				try {
					menu.showPopover();
					api.place();
				} catch ( error ) {
					api.above = false;
					menu.removeAttribute( 'popover' );
				}
			}
			menu.firstChild.focus( { preventScroll: true } );
		} );

		menu.addEventListener( 'click', function ( event ) {
			if ( event.target.closest( 'a' ) ) {
				closeMenu( true );
			}
		} );

		wrap.addEventListener( 'keydown', function ( event ) {
			if ( openMenu !== api ) {
				return;
			}
			if ( event.key === 'Escape' ) {
				event.preventDefault();
				event.stopPropagation();
				closeMenu( true );
			} else if ( event.key === 'ArrowDown' || event.key === 'ArrowUp' ) {
				var links = Array.prototype.slice.call( menu.children );
				var next = links.indexOf( document.activeElement ) + ( event.key === 'ArrowDown' ? 1 : -1 );
				event.preventDefault();
				links[ ( next + links.length ) % links.length ].focus();
			}
		} );

		// The focus goes out of the list: close it.
		wrap.addEventListener( 'focusout', function ( event ) {
			if ( openMenu === api && event.relatedTarget && ! wrap.contains( event.relatedTarget ) ) {
				closeMenu();
			}
		} );

		wrap.appendChild( button );
		wrap.appendChild( menu );
		return wrap;
	}

	/**
	 * The directions link of a marker: a link to the one map service, or a
	 * button with the list of the services. Null when the map has no directions.
	 *
	 * @param {Object} config The configuration of the map.
	 * @param {Object} item   The marker.
	 * @param {string} [name] The name of the marker, for screen readers.
	 */
	function directionsControl( config, item, name ) {
		var services = directionsServices( config );
		if ( ! services.length ) {
			return null;
		}
		var words = text.directions || 'Directions';
		if ( services.length > 1 ) {
			return directionsMenu( services, item, name ? fill( text.directionsFor || 'Directions to %s', [ name ] ) : words );
		}
		var link = serviceLink( services[ 0 ], item, 'waymorphic-map__directions', words );
		if ( name ) {
			link.setAttribute( 'aria-label', fill( text.directionsTo || 'Directions to %s (opens in a new tab)', [ name ] ) );
		}
		return link;
	}

	/**
	 * The largest height of the content of a popup: the popup, its marker and
	 * the credit of the map go in the height of the map.
	 */
	function popupHeight( map ) {
		return Math.max( 80, map.getContainer().clientHeight - 150 );
	}

	/**
	 * Makes the content of a popup: the height is not more than the map has,
	 * and a long text scrolls.
	 */
	function popupContent( html, height ) {
		var content = document.createElement( 'div' );
		content.className = 'waymorphic-map__popup';
		content.appendChild( cleanHtml( html ) );
		content.style.maxHeight = height + 'px';
		return content;
	}

	/**
	 * Moves the map when a popup that opened is not fully in the map.
	 */
	function keepInView( map, popup ) {
		var element = popup.getElement();
		if ( ! element ) {
			return;
		}
		// The focus goes into the popup when it opens. For a popup that is not fully in the map, the
		// browser then scrolls the box of the map. MapLibre sets this back later: here it is done
		// before the measurement, or the result is wrong by that distance.
		var container = map.getContainer();
		if ( container.scrollTop || container.scrollLeft ) {
			container.scrollTop = 0;
			container.scrollLeft = 0;
		}
		var box = element.getBoundingClientRect();
		var frame = container.getBoundingClientRect();
		var space = 10;
		// The credit of the map is at the bottom, above the popups.
		var below = 44;
		var dx = 0;
		var dy = 0;
		if ( box.left < frame.left + space ) {
			dx = box.left - frame.left - space;
		} else if ( box.right > frame.right - space ) {
			dx = box.right - frame.right + space;
		}
		if ( box.top < frame.top + space ) {
			dy = box.top - frame.top - space;
		} else if ( box.bottom > frame.bottom - below ) {
			dy = box.bottom - frame.bottom + below;
		}
		// A popup that is larger than the map cannot be fully in it.
		if ( box.width + 2 * space > frame.width ) {
			dx = 0;
		}
		if ( box.height + space + below > frame.height ) {
			dy = 0;
		}
		if ( dx || dy ) {
			map.panBy( [ dx, dy ], { duration: 250 } );
		}
	}

	/**
	 * The name of a marker: its title, the text of its popup, or its number.
	 */
	function markerName( item, index ) {
		if ( item.title ) {
			return String( item.title );
		}
		if ( item.popup ) {
			// The first line of the popup: "Eiffel Tower" for "<strong>Eiffel Tower</strong><br>Champ de Mars".
			// A line ends at a line break and at the end of a paragraph, a heading or a list item.
			var html = String( item.popup )
				.replace( /\s+/g, ' ' )
				.replace( /<\/?(?:br|p|div|li|h[1-6]|tr|td|th)\b/gi, '\n$&' );
			var words = ( cleanHtml( html ).textContent || '' )
				.split( '\n' )
				.map( function ( line ) {
					return line.replace( /\s+/g, ' ' ).trim();
				} )
				.filter( Boolean )[ 0 ];
			if ( words ) {
				// Full characters: an emoji is not cut in two.
				var letters = Array.from ? Array.from( words ) : words.split( '' );
				return letters.length > 80 ? letters.slice( 0, 77 ).join( '' ) + '…' : words;
			}
		}
		return fill( text.marker || 'Marker %d', [ index + 1 ] );
	}

	/**
	 * Where the popup of a marker goes, for each side of the marker on which it
	 * can open. MapLibre has these numbers for its own marker only.
	 *
	 * @param {number}   width  The width of the marker.
	 * @param {number}   height The height of the marker.
	 * @param {number[]} shift  The distance of the marker from its position, or null.
	 * @param {boolean}  pin    True for the marker of MapLibre (a pin with a round head).
	 * @return {Object} The offsets for a MapLibre popup.
	 */
	function popupOffsets( width, height, shift, pin ) {
		var x = shift ? shift[ 0 ] : 0;
		var y = shift ? shift[ 1 ] : 0;
		var side = pin ? 13.5 : width / 2;
		var up = pin ? 38.1 : height;
		var corner = pin ? 13.5 / Math.SQRT2 : 0;
		var middle = pin ? up - side : height / 2;
		var above = pin ? up - side + corner : up;
		return {
			top: [ x, y ],
			'top-left': [ x, y ],
			'top-right': [ x, y ],
			bottom: [ x, y - up ],
			'bottom-left': [ x + corner, y - above ],
			'bottom-right': [ x - corner, y - above ],
			left: [ x + side, y - middle ],
			right: [ x - side, y - middle ],
		};
	}

	/**
	 * Adds the markers of a configuration to a map.
	 *
	 * @param {Object}   map      The MapLibre map.
	 * @param {Object[]} markers  Objects with lat, lng, popup (HTML), open, title,
	 *                            colour, icon (URL) and animation (drop or bounce).
	 * @param {Object}   [config] The configuration of the map, for the directions link.
	 * @param {boolean}  [later]  True when the groups put the markers on the map (addGroups).
	 * @return {Object[]} The MapLibre markers.
	 */
	function addMarkers( map, markers, config, later ) {
		var gl = window.maplibregl;
		// A move of the map closes the list of the map services: the list does not move with the map.
		map.on( 'movestart', function () {
			closeMenu();
		} );
		// The height that a popup can have. One measurement for all the markers: a measurement for
		// each marker made the browser calculate the page again each time (1 second for 1000 markers).
		var roomForPopup = popupHeight( map );
		// Markers at one position stand in a ring around it: the visitor can click each of them.
		var places = {};
		var shifts = {};
		( markers || [] ).forEach( function ( item, index ) {
			var key = Number( item.lat ).toFixed( 5 ) + ',' + Number( item.lng ).toFixed( 5 );
			( places[ key ] = places[ key ] || [] ).push( index );
		} );
		Object.keys( places ).forEach( function ( key ) {
			var same = places[ key ];
			if ( same.length < 2 ) {
				return;
			}
			// 28 pixels between two markers: the width of a marker.
			var radius = Math.min( 60, Math.max( 14, 14 / Math.sin( Math.PI / same.length ) ) );
			same.forEach( function ( index, number ) {
				var angle = ( 2 * Math.PI * number ) / same.length - ( same.length === 2 ? Math.PI : Math.PI / 2 );
				shifts[ index ] = [ Math.round( radius * Math.cos( angle ) ), Math.round( radius * Math.sin( angle ) ) ];
			} );
		} );
		var made = ( markers || [] ).map( function ( item, index ) {
			var colour = HEX.test( item.colour || '' ) ? item.colour : MARKER_COLOUR;
			var shift = shifts[ index ] || null;
			var options = { color: colour };
			if ( shift ) {
				// The marker of MapLibre has its point 14 pixels below its middle.
				options.offset = [ shift[ 0 ], shift[ 1 ] - 14 ];
			}
			var image = null;
			if ( item.icon && safeUrl( item.icon, false ) ) {
				image = document.createElement( 'img' );
				image.alt = '';
				options = { element: document.createElement( 'div' ), anchor: 'bottom' };
				options.element.className = 'waymorphic-map__icon';
				options.element.appendChild( image );
				if ( shift ) {
					options.offset = shift;
				}
			}
			var marker = new gl.Marker( options ).setLngLat( [ item.lng, item.lat ] );
			var element = marker.getElement();
			var name = markerName( item, index );
			element.setAttribute( 'aria-label', name );
			if ( item.animation === 'drop' || item.animation === 'bounce' ) {
				var moving = 'waymorphic-map__marker--' + item.animation;
				element.classList.add( moving );
				// The markers come down one after the other.
				element.style.setProperty( '--waymorphic-delay', Math.min( index * 60, 900 ) + 'ms' );
				// One time: a marker that a group or a category hides and shows again does not move again.
				var still = function () {
					element.classList.remove( moving );
				};
				element.addEventListener( 'animationend', still );
				window.setTimeout( still, 6000 );
			}

			var control = directionsControl( config, item, name );
			var html = String( item.popup || '' );
			if ( item.title ) {
				// The popup starts with the name of the place, if its text does not.
				var words = ( cleanHtml( html ).textContent || '' ).replace( /\s+/g, ' ' ).trim().toLowerCase();
				if ( words.indexOf( String( item.title ).replace( /\s+/g, ' ' ).trim().toLowerCase() ) !== 0 ) {
					html = '<strong class="waymorphic-map__popup-title">' + escapeHtml( item.title ) + '</strong>' + ( html ? '<br>' : '' ) + html;
				}
			}
			if ( html || control ) {
				var content = popupContent( html, roomForPopup );
				if ( control ) {
					var line = document.createElement( 'p' );
					line.className = 'waymorphic-map__directions-line';
					line.appendChild( control );
					content.appendChild( line );
				}
				var popupOptions = { maxWidth: POPUP_WIDTH };
				if ( shift && ! image ) {
					popupOptions.offset = popupOffsets( 27, 41, shift, true );
				}
				var popup = new gl.Popup( popupOptions ).setDOMContent( content );
				// A picture in the popup that loads makes the popup larger.
				content.addEventListener(
					'load',
					function () {
						if ( popup.isOpen() ) {
							keepInView( map, popup );
						}
					},
					true
				);
				// True when the visitor closes the popup from inside it: then the focus goes to the marker.
				var toMarker = false;
				popup.on( 'open', function () {
					// The map can have a different height now.
					content.style.maxHeight = popupHeight( map ) + 'px';
					element.classList.add( 'waymorphic-map__marker--active' );
					keepInView( map, popup );
					var box = popup.getElement();
					// Escape closes the popup.
					box.addEventListener( 'keydown', function ( event ) {
						if ( event.key === 'Escape' ) {
							toMarker = true;
							marker.togglePopup();
						}
					} );
					box.addEventListener(
						'click',
						function ( event ) {
							toMarker = !! event.target.closest( '.maplibregl-popup-close-button' );
						},
						true
					);
				} );
				popup.on( 'close', function () {
					element.classList.remove( 'waymorphic-map__marker--active' );
					if ( openMenu && content.contains( openMenu.wrap ) ) {
						closeMenu();
					}
					if ( toMarker ) {
						// The popup had the focus and is not there now: the focus goes to the marker, not to the top of the page.
						element.focus( { preventScroll: true } );
					}
					toMarker = false;
				} );
				marker.setPopup( popup );
				element.classList.add( 'waymorphic-map__marker--popup' );
				element.addEventListener( 'keydown', function ( event ) {
					if ( event.target !== element ) {
						return;
					}
					if ( event.key === ' ' || event.key === 'Spacebar' ) {
						// MapLibre opens the popup with Enter. Space opens it here, and does not scroll the page.
						event.preventDefault();
						marker.togglePopup();
					} else if ( event.key === 'Escape' && popup.isOpen() ) {
						marker.togglePopup();
					}
				} );
			}
			if ( image ) {
				image.addEventListener( 'load', function () {
					// The popup goes at the edge of the picture: above, below or at the side of it.
					// MapLibre does this for its own marker.
					var width = element.offsetWidth || image.naturalWidth;
					var height = element.offsetHeight || image.naturalHeight;
					if ( marker.getPopup() ) {
						marker.getPopup().setOffset( popupOffsets( width, height, shift, false ) );
					}
				} );
				image.addEventListener( 'error', function () {
					// The picture did not come: the usual marker shows, so that the place is on the map.
					var pin = new gl.Marker( { color: colour } ).getElement();
					element.classList.remove( 'waymorphic-map__icon' );
					element.textContent = '';
					while ( pin.firstChild ) {
						element.appendChild( pin.firstChild );
					}
					// The point of this marker is 6.5 pixels above the bottom of its element.
					marker.setOffset( [ shift ? shift[ 0 ] : 0, ( shift ? shift[ 1 ] : 0 ) + 6.5 ] );
					if ( marker.getPopup() ) {
						marker.getPopup().setOffset( popupOffsets( 27, 41, shift, true ) );
					}
				} );
				image.src = item.icon;
			}
			if ( later && ! ( item.popup && item.open ) ) {
				// The groups put the marker on the map, if it is not in a group.
				marker.waymorphicOff = true;
				return marker;
			}
			marker.addTo( map );
			if ( item.popup && item.open ) {
				// A popup that opens with the page must not take the keyboard focus.
				marker.getPopup().options.focusAfterOpen = false;
				marker.togglePopup();
				marker.getPopup().options.focusAfterOpen = true;
				// The marker stays out of the groups, so that its popup stays open.
				marker.waymorphicAlone = true;
			}
			return marker;
		} );

		// A marker or a group that is not in the visible part of the map is not a stop of the
		// Tab key: the focus would go to a place that the visitor cannot see.
		function tabStops() {
			var frame = map.getContainer().getBoundingClientRect();
			var stops = made
				.filter( function ( marker ) {
					return !! marker.getPopup() && ! marker.waymorphicOff;
				} )
				.map( function ( marker ) {
					return marker.getElement();
				} )
				.concat( Array.prototype.slice.call( map.getContainer().querySelectorAll( '.waymorphic-map__group' ) ) );
			stops
				.map( function ( stop ) {
					var box = stop.getBoundingClientRect();
					return box.right > frame.left && box.left < frame.right && box.bottom > frame.top && box.top < frame.bottom;
				} )
				.forEach( function ( visible, number ) {
					stops[ number ].tabIndex = visible ? 0 : -1;
				} );
		}
		map.on( 'moveend', tabStops );
		map.on( 'resize', tabStops );
		window.setTimeout( tabStops, 0 );
		// The groups and the category buttons call this when the markers that show change.
		map.waymorphicTabStops = tabStops;

		return made;
	}

	var EARTH = 6371008.8;

	function radians( degrees ) {
		return ( degrees * Math.PI ) / 180;
	}

	/**
	 * The distance in metres between two points ([lng, lat]).
	 */
	function distance( from, to ) {
		var dLat = radians( to[ 1 ] - from[ 1 ] );
		var dLng = radians( to[ 0 ] - from[ 0 ] );
		var a =
			Math.sin( dLat / 2 ) * Math.sin( dLat / 2 ) +
			Math.cos( radians( from[ 1 ] ) ) * Math.cos( radians( to[ 1 ] ) ) * Math.sin( dLng / 2 ) * Math.sin( dLng / 2 );
		return 2 * EARTH * Math.asin( Math.min( 1, Math.sqrt( a ) ) );
	}

	/**
	 * The outline of a circle on the ground, as 64 points.
	 */
	function circleRing( centre, radius ) {
		var ring = [];
		var lat = radians( centre[ 1 ] );
		var lng = radians( centre[ 0 ] );
		var d = radius / EARTH;
		for ( var i = 0; i <= 64; i++ ) {
			var bearing = ( 2 * Math.PI * i ) / 64;
			var pLat = Math.asin( Math.sin( lat ) * Math.cos( d ) + Math.cos( lat ) * Math.sin( d ) * Math.cos( bearing ) );
			var pLng = lng + Math.atan2( Math.sin( bearing ) * Math.sin( d ) * Math.cos( lat ), Math.cos( d ) - Math.sin( lat ) * Math.sin( pLat ) );
			ring.push( [ ( pLng * 180 ) / Math.PI, ( pLat * 180 ) / Math.PI ] );
		}
		return ring;
	}

	/**
	 * The shapes of a configuration as GeoJSON features.
	 *
	 * @param {Object[]} shapes Objects with type (polygon, line or circle), points
	 *                          ([lng, lat]), holes (of a polygon: a list of point lists),
	 *                          radius, colour, fill, opacity, width, popup.
	 * @return {Object[]} The features.
	 */
	function shapeFeatures( shapes ) {
		var features = [];
		( shapes || [] ).forEach( function ( shape, number ) {
			if ( shape.type !== 'heatmap' ) {
				return;
			}
			( shape.points || [] ).forEach( function ( point ) {
				features.push( {
					type: 'Feature',
					geometry: { type: 'Point', coordinates: [ point[ 0 ], point[ 1 ] ] },
					properties: {
						heat: number,
						weight: typeof point[ 2 ] === 'number' ? point[ 2 ] : 1,
						radius: typeof shape.radius === 'number' ? shape.radius : 30,
						opacity: typeof shape.opacity === 'number' ? shape.opacity : 0.8,
					},
				} );
			} );
		} );
		return ( shapes || [] )
			.map( function ( shape ) {
				var points = shape.points || [];
				var geometry = null;
				if ( shape.type === 'line' && points.length > 1 ) {
					geometry = { type: 'LineString', coordinates: points };
				} else if ( shape.type === 'polygon' && points.length > 2 ) {
					geometry = { type: 'Polygon', coordinates: [ points.concat( [ points[ 0 ] ] ) ] };
					( Array.isArray( shape.holes ) ? shape.holes : [] ).forEach( function ( hole ) {
						if ( Array.isArray( hole ) && hole.length > 2 ) {
							geometry.coordinates.push( hole.concat( [ hole[ 0 ] ] ) );
						}
					} );
				} else if ( shape.type === 'circle' && points.length ) {
					geometry = { type: 'Polygon', coordinates: [ circleRing( points[ 0 ], shape.radius || 1000 ) ] };
				}
				return geometry
					? {
							type: 'Feature',
							geometry: geometry,
							properties: {
								colour: shape.colour || MARKER_COLOUR,
								fill: shape.fill || shape.colour || MARKER_COLOUR,
								opacity: typeof shape.opacity === 'number' ? shape.opacity : 0.25,
								width: typeof shape.width === 'number' ? shape.width : 3,
								popup: shape.popup || '',
							},
					  }
					: null;
			} )
			.filter( Boolean )
			.concat( features );
	}

	/**
	 * Adds shapes to a map that has its style.
	 *
	 * @param {Object}   map      The MapLibre map.
	 * @param {Object[]} features The result of shapeFeatures().
	 */
	function addShapes( map, features ) {
		var gl = window.maplibregl;
		if ( ! features.length ) {
			return;
		}
		var before = map.getSource( 'waymorphic-shapes' );
		if ( before ) {
			// The map has shapes: these go with them. A new heatmap needs its layer, which is made
			// with the first shapes only.
			map.waymorphicShapes = ( map.waymorphicShapes || [] ).concat(
				features.filter( function ( feature ) {
					return typeof feature.properties.heat !== 'number';
				} )
			);
			before.setData( { type: 'FeatureCollection', features: map.waymorphicShapes } );
			return;
		}
		map.waymorphicShapes = features.slice();
		map.addSource( 'waymorphic-shapes', { type: 'geojson', data: { type: 'FeatureCollection', features: features } } );
		// One layer for each heatmap, below the shapes.
		var heats = {};
		features.forEach( function ( feature ) {
			var number = feature.properties.heat;
			if ( typeof number !== 'number' || heats[ number ] ) {
				return;
			}
			heats[ number ] = true;
			map.addLayer( {
				id: 'waymorphic-shapes-heat-' + number,
				type: 'heatmap',
				source: 'waymorphic-shapes',
				filter: [ '==', [ 'get', 'heat' ], number ],
				paint: {
					'heatmap-weight': [ 'get', 'weight' ],
					'heatmap-radius': feature.properties.radius,
					'heatmap-opacity': feature.properties.opacity,
				},
			} );
		} );
		map.addLayer( {
			id: 'waymorphic-shapes-fill',
			type: 'fill',
			source: 'waymorphic-shapes',
			filter: [ '==', [ 'geometry-type' ], 'Polygon' ],
			paint: { 'fill-color': [ 'get', 'fill' ], 'fill-opacity': [ 'get', 'opacity' ] },
		} );
		map.addLayer( {
			id: 'waymorphic-shapes-line',
			type: 'line',
			source: 'waymorphic-shapes',
			filter: [ '!=', [ 'geometry-type' ], 'Point' ],
			layout: { 'line-join': 'round', 'line-cap': 'round' },
			paint: { 'line-color': [ 'get', 'colour' ], 'line-width': [ 'get', 'width' ] },
		} );

		// Shows the popup of a shape at a point. One shape popup shows at a time.
		function showShape( html, lngLat ) {
			if ( map.waymorphicShapePopup ) {
				map.waymorphicShapePopup.remove();
			}
			var popup = new gl.Popup( { maxWidth: POPUP_WIDTH } ).setLngLat( lngLat ).setDOMContent( popupContent( html, popupHeight( map ) ) ).addTo( map );
			map.waymorphicShapePopup = popup;
			keepInView( map, popup );
			return popup;
		}

		// A shape has no element in the page: the keyboard and a screen reader cannot get to
		// its popup. Thus each shape with a popup has a button, which shows when it has the focus.
		var keys = document.createElement( 'div' );
		keys.className = 'waymorphic-map__shape-keys';
		features.forEach( function ( feature ) {
			var name = ( cleanHtml( feature.properties.popup || '' ).textContent || '' ).replace( /\s+/g, ' ' ).trim();
			if ( ! name ) {
				return;
			}
			var line = feature.geometry.type === 'Polygon' ? feature.geometry.coordinates[ 0 ] : feature.geometry.coordinates;
			// A point of the shape: the middle of an area, a middle point of a line.
			var point = feature.geometry.type === 'Polygon' ? boundsOf( line ).getCenter() : line[ Math.floor( line.length / 2 ) ];
			var button = document.createElement( 'button' );
			button.type = 'button';
			button.className = 'waymorphic-map__shape-key';
			button.textContent = name.length > 80 ? name.slice( 0, 77 ) + '…' : name;
			button.setAttribute( 'aria-label', fill( text.shape || 'Shape on the map: %s', [ button.textContent ] ) );
			button.addEventListener( 'click', function () {
				if ( ! map.getBounds().contains( point ) ) {
					map.jumpTo( { center: point } );
				}
				var popup = showShape( feature.properties.popup, point );
				var box = popup.getElement();
				// Escape and the close button put the focus on the button of the shape again.
				box.addEventListener( 'keydown', function ( event ) {
					if ( event.key === 'Escape' ) {
						popup.remove();
					}
				} );
				popup.on( 'close', function () {
					if ( ! document.activeElement || document.activeElement === document.body ) {
						button.focus( { preventScroll: true } );
					}
				} );
			} );
			keys.appendChild( button );
		} );
		if ( keys.children.length ) {
			map.getContainer().appendChild( keys );
		}

		[ 'waymorphic-shapes-fill', 'waymorphic-shapes-line' ].forEach( function ( layer ) {
			map.on( 'click', layer, function ( event ) {
				var feature = event.features && event.features[ 0 ];
				var target = event.originalEvent.target;
				// One popup for a click on the fill and the outline of a shape.
				if ( ! feature || ! feature.properties.popup || event.originalEvent.waymorphicShape ) {
					return;
				}
				// A click on a marker or in a popup is not a click on the shape below it.
				if ( target && target.closest && target.closest( '.maplibregl-marker, .maplibregl-popup' ) ) {
					return;
				}
				event.originalEvent.waymorphicShape = true;
				showShape( feature.properties.popup, event.lngLat );
			} );
			map.on( 'mousemove', layer, function ( event ) {
				var feature = event.features && event.features[ 0 ];
				map.getCanvas().style.cursor = feature && feature.properties.popup ? 'pointer' : '';
			} );
			map.on( 'mouseleave', layer, function () {
				map.getCanvas().style.cursor = '';
			} );
		} );
	}

	/**
	 * Shows or hides a marker: a filter or the search hides it
	 * (waymorphicHidden), and a group hides it (waymorphicGrouped).
	 */
	/**
	 * Puts the markers that show on the map and takes the other markers off it
	 * (the markers of a group, the markers that a category or a search hides).
	 * MapLibre moves each marker that is on the map at each frame of a move:
	 * with many markers that are not visible, the map was slow.
	 *
	 * @param {Object}   map       The MapLibre map.
	 * @param {Object[]} glMarkers The MapLibre markers.
	 */
	function showOrHide( map, glMarkers ) {
		var added = false;
		glMarkers.forEach( function ( marker ) {
			var visible = ! marker.waymorphicHidden && ! marker.waymorphicGrouped;
			if ( visible && marker.waymorphicOff ) {
				marker.waymorphicOff = false;
				marker.waymorphicNew = true;
				if ( map.waymorphicShown ) {
					// The animation is for the start of the page, not for a marker that comes back
					// or that comes out of a group.
					marker.getElement().classList.remove( 'waymorphic-map__marker--drop', 'waymorphic-map__marker--bounce' );
				}
				marker.addTo( map );
				added = true;
			} else if ( ! visible && ! marker.waymorphicOff ) {
				marker.waymorphicOff = true;
				// This closes the popup of the marker also.
				marker.remove();
			}
		} );
		map.waymorphicShown = true;
		if ( ! added ) {
			return;
		}
		// The markers stay in their sequence in the page: the same marker is on top of its
		// neighbour each time, and the Tab key goes through them in the sequence of the list.
		var next = null;
		for ( var i = glMarkers.length - 1; i >= 0; i-- ) {
			var marker = glMarkers[ i ];
			if ( marker.waymorphicOff ) {
				continue;
			}
			var element = marker.getElement();
			if ( marker.waymorphicNew ) {
				marker.waymorphicNew = false;
				if ( next && next.parentNode ) {
					next.parentNode.insertBefore( element, next );
				}
			}
			next = element;
		}
	}

	/**
	 * Puts markers that are near to each other on the screen in a group: one
	 * circle with their number. A click on the circle zooms to its markers.
	 *
	 * @param {Object}   map       The MapLibre map.
	 * @param {Object[]} glMarkers The MapLibre markers.
	 * @return {Function} Call it when the markers that a filter hides change.
	 */
	function addGroups( map, glMarkers ) {
		var gl = window.maplibregl;
		var circles = [];

		function update() {
			// The circle that has the keyboard focus goes away: keep the focus in the map.
			var focus = circles.some( function ( circle ) {
				return circle.getElement() === document.activeElement;
			} );
			circles.forEach( function ( circle ) {
				circle.remove();
			} );
			circles = [];
			if ( focus ) {
				map.getCanvas().focus( { preventScroll: true } );
			}
			var groups = [];
			// From zoom 17, each marker shows: markers at one point stay apart from the others.
			var apart = map.getZoom() >= 17;
			glMarkers.forEach( function ( marker ) {
				marker.waymorphicGrouped = false;
				if ( marker.waymorphicHidden || marker.waymorphicAlone || apart ) {
					return;
				}
				var point = map.project( marker.getLngLat() );
				for ( var i = 0; i < groups.length; i++ ) {
					var dx = groups[ i ].point.x - point.x;
					var dy = groups[ i ].point.y - point.y;
					if ( dx * dx + dy * dy < 60 * 60 ) {
						groups[ i ].markers.push( marker );
						return;
					}
				}
				groups.push( { point: point, markers: [ marker ] } );
			} );
			groups.forEach( function ( group ) {
				if ( group.markers.length < 2 ) {
					return;
				}
				var bounds = new gl.LngLatBounds();
				var lng = 0;
				var lat = 0;
				group.markers.forEach( function ( marker ) {
					var position = marker.getLngLat();
					marker.waymorphicGrouped = true;
					bounds.extend( position );
					lng += position.lng;
					lat += position.lat;
				} );
				var button = document.createElement( 'button' );
				button.type = 'button';
				button.className = 'waymorphic-map__group';
				button.textContent = group.markers.length;
				button.setAttribute( 'aria-label', fill( text.group || 'Markers here: %d. Zoom in.', [ group.markers.length ] ) );
				button.addEventListener( 'click', function ( event ) {
					event.stopPropagation();
					var camera = map.cameraForBounds( bounds, { padding: fitPadding( map.getContainer() ) } );
					// A click on a group goes nearer by one zoom level or more, also on a small map.
					// From zoom 17, each marker shows.
					var zoom = Math.max( camera && isFinite( camera.zoom ) ? camera.zoom : 17, map.getZoom() + 1 );
					map.easeTo( { center: bounds.getCenter(), zoom: Math.min( 17, zoom ) } );
				} );
				circles.push(
					new gl.Marker( { element: button } )
						.setLngLat( [ lng / group.markers.length, lat / group.markers.length ] )
						.addTo( map )
				);
			} );
			showOrHide( map, glMarkers );
			if ( map.waymorphicTabStops ) {
				map.waymorphicTabStops();
			}
		}

		map.on( 'zoomend', update );
		map.on( 'resize', update );
		update();
		return update;
	}

	function firstOf( object, names ) {
		for ( var i = 0; i < names.length; i++ ) {
			var value = object[ names[ i ] ];
			if ( value !== undefined && value !== null && String( value ).trim() !== '' ) {
				return String( value ).trim();
			}
		}
		return '';
	}

	// The text of HTML, as KML and GPX descriptions can have HTML.
	function plain( value ) {
		var words = String( value || '' );
		// HTML only when the text has a tag (<b>, </p>, <br/>) or a character reference (&amp;).
		// "Coffee<Tea" and "5 < 6" are text.
		if ( /<\/?[a-z][a-z0-9-]*(?:\s[^<>]*)?\/?>|&(?:[a-z][a-z0-9]*|#\d+|#x[0-9a-f]+);/i.test( words ) ) {
			// A space between the lines and the paragraphs.
			words = words.replace( /<\/?(?:br|p|div|li|h[1-6]|tr|td|th)\b/gi, ' $&' );
			words = new window.DOMParser().parseFromString( words, 'text/html' ).body.textContent || '';
		}
		words = words.replace( /\s+/g, ' ' ).trim();
		return words.length > 1000 ? words.slice( 0, 999 ) + '…' : words;
	}

	/**
	 * A latitude or a longitude from a file: 51.5074, "51,5074" (a decimal
	 * comma), "0.1276 W" or "S 33.87" (a letter for the side). NaN when the
	 * text is not a number.
	 */
	function coordinate( value ) {
		if ( typeof value === 'number' ) {
			return value;
		}
		var match = /^([nsew])?\s*([+-]?\d+(?:[.,]\d+)?(?:e[+-]?\d+)?)\s*°?\s*([nsew])?$/i.exec( String( value === undefined || value === null ? '' : value ).trim() );
		if ( ! match ) {
			return NaN;
		}
		var number = parseFloat( match[ 2 ].replace( ',', '.' ) );
		var side = ( match[ 1 ] || match[ 3 ] || '' ).toLowerCase();
		return side === 's' || side === 'w' ? -Math.abs( number ) : number;
	}

	function validPoint( lng, lat ) {
		return isFinite( lng ) && isFinite( lat ) && Math.abs( lat ) <= 90 && Math.abs( lng ) <= 180;
	}

	// The rows of CSV text. Fields can have quotes.
	function csvRows( content ) {
		var first = content.split( /\r?\n/ )[ 0 ] || '';
		var divider = first.split( ';' ).length > first.split( ',' ).length ? ';' : first.split( '\t' ).length > first.split( ',' ).length ? '\t' : ',';
		var rows = [];
		var row = [];
		var field = '';
		var quoted = false;
		for ( var i = 0; i < content.length; i++ ) {
			var c = content[ i ];
			if ( quoted ) {
				if ( c === '"' && content[ i + 1 ] === '"' ) {
					field += '"';
					i++;
				} else if ( c === '"' ) {
					quoted = false;
				} else {
					field += c;
				}
			} else if ( c === '"' && field.trim() === '' ) {
				// A quote opens a field only at the start of the field: 12" Pizza is text.
				quoted = true;
				field = '';
			} else if ( c === divider ) {
				row.push( field );
				field = '';
			} else if ( c === '\n' || c === '\r' ) {
				if ( c === '\r' && content[ i + 1 ] === '\n' ) {
					i++;
				}
				row.push( field );
				rows.push( row );
				row = [];
				field = '';
			} else {
				field += c;
			}
		}
		if ( field !== '' || row.length ) {
			row.push( field );
			rows.push( row );
		}
		return rows;
	}

	/**
	 * Reads the markers and the shapes of a file: CSV, GeoJSON, KML or GPX.
	 *
	 * @param {string} content The text of the file.
	 * @param {string} [name]  The name or the address of the file.
	 * @return {{markers: Object[], shapes: Object[]}} Markers with lat, lng, title,
	 *         text (no HTML), category, colour and icon. Shapes with type (line or
	 *         polygon), points ([lng, lat]), colour, fill and text.
	 */
	function parseData( content, name ) {
		var result = { markers: [], shapes: [] };
		content = String( content || '' ).replace( /^\uFEFF/, '' ).trim();
		var kind = ( /\.(csv|gpx|kml|geojson|json)(?:$|[?#])/i.exec( name || '' ) || [] )[ 1 ];
		kind = kind ? kind.toLowerCase() : '';
		if ( content[ 0 ] === '{' || content[ 0 ] === '[' ) {
			kind = 'json';
		} else if ( content[ 0 ] === '<' ) {
			kind = 'xml';
		} else if ( ! kind || kind === 'json' || kind === 'geojson' ) {
			kind = 'csv';
		}

		function marker( lng, lat, values ) {
			lng = coordinate( lng );
			lat = coordinate( lat );
			if ( ! validPoint( lng, lat ) ) {
				return;
			}
			var item = { lat: lat, lng: lng };
			var title = plain( values.title ).slice( 0, 200 );
			var words = plain( values.text );
			if ( title ) {
				item.title = title;
			}
			if ( words && words !== title ) {
				item.text = words;
			}
			if ( values.category ) {
				item.category = plain( values.category ).slice( 0, 100 );
			}
			if ( HEX.test( values.colour || '' ) ) {
				item.colour = values.colour.toLowerCase();
			}
			if ( /^https?:\/\//i.test( values.icon || '' ) ) {
				item.icon = values.icon;
			}
			result.markers.push( item );
		}

		// The points of a line or of the edge of a polygon.
		function ring( type, points ) {
			points = ( Array.isArray( points ) ? points : [] )
				.map( function ( point ) {
					return point ? [ coordinate( point[ 0 ] ), coordinate( point[ 1 ] ) ] : [ NaN, NaN ];
				} )
				.filter( function ( point ) {
					return validPoint( point[ 0 ], point[ 1 ] );
				} );
			if ( type === 'polygon' && points.length > 3 ) {
				var last = points[ points.length - 1 ];
				if ( last[ 0 ] === points[ 0 ][ 0 ] && last[ 1 ] === points[ 0 ][ 1 ] ) {
					points.pop();
				}
			}
			return points.length < ( type === 'polygon' ? 3 : 2 ) ? null : points;
		}

		function shape( type, points, values, holes ) {
			points = ring( type, points );
			if ( ! points ) {
				return;
			}
			var item = { type: type, points: points };
			// The holes of a polygon: the map does not fill them.
			holes = ( holes || [] )
				.map( function ( hole ) {
					return ring( 'polygon', hole );
				} )
				.filter( Boolean );
			if ( type === 'polygon' && holes.length ) {
				item.holes = holes;
			}
			var words = [ plain( values.title ), plain( values.text ) ].filter( Boolean ).join( ': ' );
			if ( words ) {
				item.text = words;
			}
			if ( HEX.test( values.colour || '' ) ) {
				item.colour = values.colour.toLowerCase();
			}
			if ( HEX.test( values.fill || '' ) ) {
				item.fill = values.fill.toLowerCase();
			}
			result.shapes.push( item );
		}

		function geometry( part, values ) {
			if ( ! part || typeof part !== 'object' ) {
				return;
			}
			var c = part.coordinates;
			if ( part.type === 'GeometryCollection' ) {
				( part.geometries || [] ).forEach( function ( inner ) {
					geometry( inner, values );
				} );
			} else if ( ! Array.isArray( c ) ) {
				return;
			} else if ( part.type === 'Point' ) {
				marker( c[ 0 ], c[ 1 ], values );
			} else if ( part.type === 'MultiPoint' ) {
				c.forEach( function ( point ) {
					if ( Array.isArray( point ) ) {
						marker( point[ 0 ], point[ 1 ], values );
					}
				} );
			} else if ( part.type === 'LineString' ) {
				shape( 'line', c, values );
			} else if ( part.type === 'MultiLineString' ) {
				c.forEach( function ( line ) {
					shape( 'line', line, values );
				} );
			} else if ( part.type === 'Polygon' ) {
				shape( 'polygon', c[ 0 ], values, c.slice( 1 ) );
			} else if ( part.type === 'MultiPolygon' ) {
				c.forEach( function ( polygon ) {
					if ( Array.isArray( polygon ) ) {
						shape( 'polygon', polygon[ 0 ], values, polygon.slice( 1 ) );
					}
				} );
			}
		}

		function feature( item ) {
			if ( ! item || typeof item !== 'object' ) {
				return;
			}
			if ( item.type === 'FeatureCollection' ) {
				( Array.isArray( item.features ) ? item.features : [] ).forEach( feature );
				return;
			}
			try {
				if ( item.type === 'Feature' ) {
					var p = item.properties || {};
					geometry( item.geometry, {
						title: firstOf( p, [ 'title', 'name', 'Name' ] ),
						text: firstOf( p, [ 'description', 'popup', 'text', 'desc' ] ),
						category: firstOf( p, [ 'category' ] ),
						colour: firstOf( p, [ 'colour', 'color', 'marker-color', 'stroke' ] ),
						fill: firstOf( p, [ 'fill' ] ),
						icon: firstOf( p, [ 'icon' ] ),
					} );
				} else {
					geometry( item, {} );
				}
			} catch ( error ) {
				// A feature with wrong data: the other features of the file show.
			}
		}

		if ( kind === 'json' ) {
			try {
				var data = JSON.parse( content );
				( Array.isArray( data ) ? data : [ data ] ).forEach( feature );
			} catch ( error ) {
				// Not JSON: no markers.
			}
			return result;
		}

		if ( kind === 'xml' ) {
			var doc = new window.DOMParser().parseFromString( content, 'application/xml' );
			var all = function ( node, tag ) {
				return Array.prototype.slice.call( node.getElementsByTagNameNS( '*', tag ) );
			};
			var child = function ( node, tag ) {
				for ( var i = 0; i < node.children.length; i++ ) {
					if ( node.children[ i ].localName === tag ) {
						return node.children[ i ].textContent || '';
					}
				}
				return '';
			};
			var kml = function ( node ) {
				return ( node.textContent || '' )
					.trim()
					// "-0.1276, 51.5074, 0": some programs write a space after the comma.
					.replace( /\s*,\s*/g, ',' )
					.split( /\s+/ )
					.map( function ( pair ) {
						return pair.split( ',' );
					} );
			};
			// KML.
			all( doc, 'Placemark' ).forEach( function ( place ) {
				var values = { title: child( place, 'name' ), text: child( place, 'description' ) };
				all( place, 'Point' ).forEach( function ( node ) {
					var point = kml( all( node, 'coordinates' )[ 0 ] || node )[ 0 ] || [];
					marker( point[ 0 ], point[ 1 ], values );
				} );
				all( place, 'LineString' ).forEach( function ( node ) {
					shape( 'line', kml( all( node, 'coordinates' )[ 0 ] || node ), values );
				} );
				all( place, 'Polygon' ).forEach( function ( node ) {
					var edge = all( node, 'outerBoundaryIs' )[ 0 ] || node;
					var holes = all( node, 'innerBoundaryIs' ).map( function ( inner ) {
						return kml( all( inner, 'coordinates' )[ 0 ] || inner );
					} );
					shape( 'polygon', kml( all( edge, 'coordinates' )[ 0 ] || edge ), values, holes );
				} );
				// A track of Google Earth: one position in each gx:coord element, with spaces.
				all( place, 'Track' ).forEach( function ( node ) {
					shape(
						'line',
						all( node, 'coord' ).map( function ( position ) {
							return ( position.textContent || '' ).trim().split( /\s+/ );
						} ),
						values
					);
				} );
			} );
			// GPX.
			var gpx = function ( nodes ) {
				return nodes.map( function ( node ) {
					return [ node.getAttribute( 'lon' ), node.getAttribute( 'lat' ) ];
				} );
			};
			all( doc, 'wpt' ).forEach( function ( node ) {
				marker( node.getAttribute( 'lon' ), node.getAttribute( 'lat' ), {
					title: child( node, 'name' ),
					text: child( node, 'desc' ) || child( node, 'cmt' ),
				} );
			} );
			all( doc, 'trk' ).forEach( function ( track ) {
				var values = { title: child( track, 'name' ), text: child( track, 'desc' ) };
				all( track, 'trkseg' ).forEach( function ( part ) {
					shape( 'line', gpx( all( part, 'trkpt' ) ), values );
				} );
			} );
			all( doc, 'rte' ).forEach( function ( route ) {
				shape( 'line', gpx( all( route, 'rtept' ) ), { title: child( route, 'name' ), text: child( route, 'desc' ) } );
			} );
			return result;
		}

		// CSV: the first row has the names of the columns.
		var rows = csvRows( content );
		var head = ( rows.shift() || [] ).map( function ( cell ) {
			// "Lat." and "Long:" are lat and long.
			return cell.trim().toLowerCase().replace( /[\s.:]+$/, '' );
		} );
		rows.forEach( function ( row ) {
			var record = {};
			head.forEach( function ( column, index ) {
				record[ column ] = row[ index ];
			} );
			marker( firstOf( record, [ 'lng', 'lon', 'long', 'longitude', 'x' ] ), firstOf( record, [ 'lat', 'latitude', 'y' ] ), {
				title: firstOf( record, [ 'title', 'name', 'label' ] ),
				text: firstOf( record, [ 'description', 'popup', 'text', 'address' ] ),
				category: firstOf( record, [ 'category' ] ),
				colour: firstOf( record, [ 'colour', 'color' ] ),
				icon: firstOf( record, [ 'icon' ] ),
			} );
		} );
		return result;
	}

	/**
	 * The text of a file. The files of spreadsheet programs are frequently not
	 * UTF-8: then the letters with accents were wrong.
	 *
	 * @param {ArrayBuffer} buffer The bytes of the file.
	 * @return {string} The text.
	 */
	function decodeText( buffer ) {
		var bytes = new Uint8Array( buffer.slice( 0, 2 ) );
		if ( bytes.length === 2 && ( ( bytes[ 0 ] === 0xff && bytes[ 1 ] === 0xfe ) || ( bytes[ 0 ] === 0xfe && bytes[ 1 ] === 0xff ) ) ) {
			return new window.TextDecoder( bytes[ 0 ] === 0xff ? 'utf-16le' : 'utf-16be' ).decode( buffer );
		}
		try {
			return new window.TextDecoder( 'utf-8', { fatal: true } ).decode( buffer );
		} catch ( error ) {
			// Not UTF-8: the Windows code page of Western Europe.
			return new window.TextDecoder( 'windows-1252' ).decode( buffer );
		}
	}

	/**
	 * Gets the files of a map and reads them.
	 *
	 * @param {Object[]} files Objects with url, and the optional colour and category
	 *                         for the markers and shapes that have none.
	 * @return {Promise<{markers: Object[], shapes: Object[]}>} With the popup HTML made.
	 */
	function loadFiles( files ) {
		return Promise.all(
			files.map( function ( file ) {
				// A file that gives no answer in 15 seconds does not stop the map.
				var controller = window.AbortController ? new window.AbortController() : null;
				var timer = window.setTimeout( function () {
					if ( controller ) {
						controller.abort();
					}
				}, 15000 );
				return window
					.fetch( file.url, controller ? { signal: controller.signal } : {} )
					.then( function ( response ) {
						if ( ! response.ok ) {
							throw new Error( 'HTTP ' + response.status );
						}
						return response.arrayBuffer();
					} )
					.then( function ( buffer ) {
						var data = parseData( decodeText( buffer ), file.url );
						data.markers.forEach( function ( item ) {
							var html = item.title ? '<strong>' + escapeHtml( item.title ) + '</strong>' : '';
							if ( item.text ) {
								html += ( html ? '<br>' : '' ) + escapeHtml( item.text );
							}
							item.popup = html;
							item.colour = item.colour || file.colour;
							item.category = item.category || file.category;
						} );
						data.shapes.forEach( function ( item ) {
							item.popup = item.text ? escapeHtml( item.text ) : '';
							item.colour = item.colour || file.colour;
						} );
						return data;
					} )
					.catch( function () {
						// A file that does not come does not stop the map.
						return { markers: [], shapes: [] };
					} )
					.then( function ( data ) {
						window.clearTimeout( timer );
						return data;
					} );
			} )
		).then( function ( all ) {
			return all.reduce(
				function ( sum, data ) {
					return { markers: sum.markers.concat( data.markers ), shapes: sum.shapes.concat( data.shapes ) };
				},
				{ markers: [], shapes: [] }
			);
		} );
	}

	/**
	 * A distance in the unit of the map, as text.
	 */
	function distanceText( metres, unit ) {
		var value = metres / ( unit === 'mi' ? 1609.344 : 1000 );
		return amountText( value < 10 ? Math.round( value * 10 ) / 10 : Math.round( value ), unit );
	}

	/**
	 * A number of kilometres or miles with its unit, as text: "12.5 km".
	 */
	function amountText( amount, unit ) {
		var number;
		try {
			// The number format of the language of the page, not of the browser.
			number = amount.toLocaleString( document.documentElement.lang || undefined, { maximumFractionDigits: 2 } );
		} catch ( error ) {
			number = String( amount );
		}
		return fill( text.amount || '%1$s %2$s', [ number, unit === 'mi' ? text.mi || 'mi' : text.km || 'km' ] );
	}

	/**
	 * The bounds of points ([lng, lat]). Points on the two sides of the 180°
	 * line (Fiji and Samoa) give bounds across that line, not around the world.
	 */
	function boundsOf( points ) {
		var gl = window.maplibregl;
		var bounds = new gl.LngLatBounds();
		var across = new gl.LngLatBounds();
		points.forEach( function ( point ) {
			bounds.extend( [ point[ 0 ], point[ 1 ] ] );
			across.extend( [ point[ 0 ] < 0 ? point[ 0 ] + 360 : point[ 0 ], point[ 1 ] ] );
		} );
		return points.length && across.getEast() - across.getWest() < bounds.getEast() - bounds.getWest() ? across : bounds;
	}

	/**
	 * The space around a view that fits markers: less on a small map.
	 */
	function fitPadding( element ) {
		var width = element.clientWidth;
		var height = element.clientHeight;
		var space = Math.max( 10, Math.min( 60, Math.floor( Math.min( width, height ) / 5 ) ) );
		// More at the top for the head of a marker. More at the bottom of a narrow map: there
		// the credit of the map is open at the start and has two to four lines.
		var top = Math.min( space + 20, Math.floor( height / 3 ) );
		var bottom = Math.min( space + ( width < 300 ? 60 : width < 640 ? 25 : 0 ), Math.floor( height / 3 ) );
		return { top: Math.max( top, 0 ), right: space, bottom: Math.max( bottom, 0 ), left: space };
	}

	/**
	 * The parts around the map: the search for the nearest markers and the
	 * category buttons above it, the list of the markers below it.
	 *
	 * @param {HTMLElement} element   The container of the map.
	 * @param {Object}      map       The MapLibre map.
	 * @param {Object}      config    The configuration.
	 * @param {Object[]}    glMarkers The MapLibre markers, in the sequence of config.markers.
	 * @param {Function}    [regroup] The result of addGroups(), when the map has groups.
	 */
	function addPanels( element, map, config, glMarkers, regroup ) {
		var gl = window.maplibregl;
		var items = config.markers || [];
		var unit = config.unit === 'mi' ? 'mi' : 'km';
		var state = { category: '', origin: null, where: '', radius: 0, distances: [], selected: -1, pending: -1 };
		var originMarker = null;
		// The view of the map before a search.
		var home = null;
		// The element with the category buttons.
		var chips = null;
		var list = null;
		var status = null;
		// The buttons of the rows that show, by the number of their marker.
		var rows = {};
		// True when the map is not there now (it starts again after the browser took its drawing context away).
		var gone = false;
		map.on( 'remove', function () {
			gone = true;
			// The search, the category buttons and the list do nothing until the map starts again.
			[ top, list ].forEach( function ( part ) {
				if ( part ) {
					part.setAttribute( 'inert', '' );
				}
			} );
		} );

		function isVisible( index ) {
			if ( state.category && items[ index ].category !== state.category ) {
				return false;
			}
			return ! state.origin || state.distances[ index ] <= state.radius;
		}

		// Makes one marker the selected marker, in the list and on the map. -1: no marker.
		function selectMarker( index ) {
			if ( state.selected === index ) {
				return;
			}
			if ( rows[ state.selected ] ) {
				rows[ state.selected ].removeAttribute( 'aria-current' );
				rows[ state.selected ].parentNode.classList.remove( 'is-selected' );
			}
			if ( glMarkers[ state.selected ] ) {
				glMarkers[ state.selected ].getElement().classList.remove( 'waymorphic-map__marker--active' );
			}
			state.selected = index;
			if ( glMarkers[ index ] ) {
				glMarkers[ index ].getElement().classList.add( 'waymorphic-map__marker--active' );
			}
			var row = rows[ index ];
			if ( row ) {
				row.setAttribute( 'aria-current', 'true' );
				row.parentNode.classList.add( 'is-selected' );
				// Show the row in the list. The page does not scroll.
				var top = row.parentNode.offsetTop;
				var bottom = top + row.parentNode.offsetHeight;
				if ( top < list.scrollTop ) {
					list.scrollTop = top;
				} else if ( bottom > list.scrollTop + list.clientHeight ) {
					list.scrollTop = bottom - list.clientHeight;
				}
			}
		}

		// The popup of the marker that the list selected, when the marker shows.
		function openPopup( index ) {
			var marker = glMarkers[ index ];
			var popup = marker && marker.getPopup();
			if ( ! popup || popup.isOpen() || state.selected !== index || marker.waymorphicHidden || marker.waymorphicGrouped ) {
				return;
			}
			// The focus stays in the list.
			popup.options.focusAfterOpen = false;
			marker.togglePopup();
			popup.options.focusAfterOpen = true;
		}

		// The zoom at which a marker is not in a group: its nearest marker is more than 60 pixels away.
		function apartZoom( marker ) {
			var point = map.project( marker.getLngLat() );
			var nearest = Infinity;
			glMarkers.forEach( function ( other ) {
				if ( other === marker || other.waymorphicHidden ) {
					return;
				}
				var otherPoint = map.project( other.getLngLat() );
				var dx = otherPoint.x - point.x;
				var dy = otherPoint.y - point.y;
				nearest = Math.min( nearest, Math.sqrt( dx * dx + dy * dy ) );
			} );
			if ( nearest === Infinity ) {
				return map.getZoom();
			}
			// From zoom 17, each marker shows.
			return nearest < 0.01 ? 17 : Math.min( 17, map.getZoom() + Math.log( 64 / nearest ) / Math.LN2 );
		}

		// Goes to a marker and opens its popup: a click on a row of the list.
		function show( index ) {
			if ( gone ) {
				return;
			}
			var marker = glMarkers[ index ];
			var item = items[ index ];
			closeMenu();
			glMarkers.forEach( function ( other ) {
				var popup = other.getPopup();
				if ( other !== marker && popup && popup.isOpen() ) {
					other.togglePopup();
				}
			} );
			if ( map.waymorphicShapePopup ) {
				map.waymorphicShapePopup.remove();
			}
			selectMarker( index );
			var zoom = Math.max( map.getZoom(), 14 );
			if ( regroup ) {
				zoom = Math.max( zoom, apartZoom( marker ) );
			}
			state.pending = -1;
			if ( config.interactive === false && ! marker.waymorphicGrouped && map.getBounds().contains( marker.getLngLat() ) ) {
				// A still map has no buttons to go back to the first view: the view does not change.
				openPopup( index );
			} else {
				map.easeTo( { center: [ item.lng, item.lat ], zoom: zoom } );
				if ( map.isMoving() ) {
					// The popup opens when the map is there: then the marker is not in a group.
					state.pending = index;
				} else {
					openPopup( index );
				}
			}
			if ( element.scrollIntoView ) {
				var still = window.matchMedia && window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;
				element.scrollIntoView( { block: 'nearest', behavior: still ? 'auto' : 'smooth' } );
			}
		}

		map.on( 'moveend', function () {
			var index = state.pending;
			state.pending = -1;
			if ( index !== -1 ) {
				openPopup( index );
			}
		} );

		// A popup that opens or closes on the map selects the row of its marker.
		glMarkers.forEach( function ( marker, index ) {
			var popup = marker.getPopup();
			if ( ! popup ) {
				return;
			}
			popup.on( 'open', function () {
				selectMarker( index );
			} );
			popup.on( 'close', function () {
				if ( state.selected === index ) {
					selectMarker( -1 );
				}
			} );
			if ( popup.isOpen() ) {
				state.selected = index;
			}
		} );

		function draw() {
			var shown = [];
			if ( gone ) {
				return shown;
			}
			glMarkers.forEach( function ( marker, index ) {
				var visible = isVisible( index );
				marker.waymorphicHidden = ! visible;
				if ( visible ) {
					shown.push( index );
				}
			} );
			if ( regroup ) {
				regroup();
			} else {
				showOrHide( map, glMarkers );
				if ( map.waymorphicTabStops ) {
					map.waymorphicTabStops();
				}
			}
			if ( shown.indexOf( state.selected ) === -1 ) {
				selectMarker( -1 );
			}
			if ( state.origin ) {
				shown.sort( function ( a, b ) {
					return state.distances[ a ] - state.distances[ b ];
				} );
			}
			if ( list ) {
				closeMenu();
				list.textContent = '';
				rows = {};
				shown.forEach( function ( index ) {
					var item = items[ index ];
					var name = markerName( item, index );
					var row = document.createElement( 'li' );
					row.className = 'waymorphic-map__list-item';
					var button = document.createElement( 'button' );
					button.type = 'button';
					button.className = 'waymorphic-map__list-button';
					if ( index === state.selected ) {
						button.setAttribute( 'aria-current', 'true' );
						row.classList.add( 'is-selected' );
					}
					var swatch = document.createElement( 'span' );
					swatch.className = 'waymorphic-map__list-dot';
					swatch.setAttribute( 'aria-hidden', 'true' );
					swatch.style.background = HEX.test( item.colour || '' ) ? item.colour : MARKER_COLOUR;
					button.appendChild( swatch );
					var words = document.createElement( 'span' );
					words.className = 'waymorphic-map__list-text';
					var label = document.createElement( 'span' );
					label.className = 'waymorphic-map__list-name';
					label.textContent = name;
					words.appendChild( label );
					var details = [];
					if ( item.category ) {
						details.push( item.category );
					}
					if ( state.origin ) {
						details.push( distanceText( state.distances[ index ], unit ) );
					}
					if ( details.length ) {
						var detail = document.createElement( 'span' );
						detail.className = 'waymorphic-map__list-detail';
						detail.textContent = details.join( ' · ' );
						// The space is for screen readers: they read the name, then the detail.
						words.appendChild( document.createTextNode( ' ' ) );
						words.appendChild( detail );
					}
					button.appendChild( words );
					button.addEventListener( 'click', function () {
						show( index );
					} );
					row.appendChild( button );
					var control = directionsControl( config, item, name );
					if ( control ) {
						row.appendChild( control );
					}
					list.appendChild( row );
					rows[ index ] = button;
				} );
				list.hidden = shown.length === 0;
			}
			return shown;
		}

		function say( message ) {
			if ( status ) {
				status.textContent = message || '';
			}
		}

		// Tells the result of the search for the nearest markers: the number of the markers that show.
		function report( shown ) {
			if ( ! state.origin ) {
				return;
			}
			// The distance as the visitor selected it: "12.5 km" is not "13 km".
			var range = amountText( Math.round( ( state.radius / ( unit === 'mi' ? 1609.344 : 1000 ) ) * 100 ) / 100, unit );
			if ( state.where ) {
				// With the name of the place that the search found: the visitor sees a wrong town.
				say(
					shown.length
						? fill( text.foundAt || 'Places in %2$s of %3$s: %1$d', [ shown.length, range, state.where ] )
						: fill( text.noneAt || 'No places in %1$s of %2$s.', [ range, state.where ] )
				);
			} else {
				say(
					shown.length
						? fill( text.found || 'Places in %2$s: %1$d', [ shown.length, range ] )
						: fill( text.none || 'No places in %s.', [ range ] )
				);
			}
		}

		// The view after a search: the place of the search and the markers that show, or the area of the search.
		function fitShown( shown ) {
			var view = [ state.origin ].concat(
				shown.length
					? shown.map( function ( index ) {
							return [ items[ index ].lng, items[ index ].lat ];
					  } )
					: circleRing( state.origin, state.radius )
			);
			map.fitBounds( boundsOf( view ), { padding: fitPadding( element ), maxZoom: 15 } );
		}

		// Show the markers that are near a point. where: the name of the point, when it is a new point.
		function near( origin, radius, where ) {
			if ( gone ) {
				// The answer of a search came after the map went away.
				return;
			}
			if ( ! state.origin ) {
				// "Show all" goes back to this view.
				home = { center: map.getCenter(), zoom: map.getZoom() };
			}
			if ( where !== undefined ) {
				state.where = where;
			}
			state.origin = origin;
			state.radius = radius * ( unit === 'mi' ? 1609.344 : 1000 );
			state.distances = items.map( function ( item ) {
				return distance( origin, [ item.lng, item.lat ] );
			} );
			if ( ! originMarker ) {
				// A dot, not a marker: the place of the search is not one of the places of the map.
				var dot = document.createElement( 'div' );
				dot.className = 'waymorphic-map__origin';
				originMarker = new gl.Marker( { element: dot } );
				dot.setAttribute( 'aria-label', text.origin || 'The place of your search' );
			}
			originMarker.setLngLat( origin ).addTo( map );
			var shown = draw();
			report( shown );
			fitShown( shown );
		}

		// The page can have the elements already: PHP makes the space for the tools and the list
		// as text, so that the page does not jump when the map starts.
		var before = element.previousElementSibling;
		var after = element.nextElementSibling;
		var top = before && before.classList.contains( 'waymorphic-map__tools' ) ? before : document.createElement( 'div' );
		top.className = 'waymorphic-map__tools';
		top.textContent = '';
		top.removeAttribute( 'inert' );

		if ( config.locator ) {
			var form = document.createElement( 'form' );
			form.className = 'waymorphic-map__locator';
			form.setAttribute( 'role', 'search' );
			form.setAttribute( 'aria-label', text.searchLabel || 'Find the nearest places' );

			var input = document.createElement( 'input' );
			input.type = 'search';
			input.className = 'waymorphic-map__locator-input';
			input.placeholder = text.searchHint || 'Address, town or postcode';
			input.setAttribute( 'aria-label', text.searchHint || 'Address, town or postcode' );
			input.autocomplete = 'off';
			form.appendChild( input );

			var select = document.createElement( 'select' );
			select.className = 'waymorphic-map__locator-radius';
			select.setAttribute( 'aria-label', text.radius || 'Distance' );
			var first = Number( config.locator.radius ) || 25;
			[ 1, 5, 10, 25, 50, 100, 200 ]
				.concat( [ first ] )
				.filter( function ( value, index, all ) {
					return all.indexOf( value ) === index;
				} )
				.sort( function ( a, b ) {
					return a - b;
				} )
				.forEach( function ( value ) {
					var option = document.createElement( 'option' );
					option.value = value;
					option.textContent = amountText( value, unit );
					option.selected = value === first;
					select.appendChild( option );
				} );
			form.appendChild( select );

			var submit = document.createElement( 'button' );
			submit.type = 'submit';
			submit.className = 'waymorphic-map__button';
			submit.textContent = text.search || 'Search';
			form.appendChild( submit );

			var here = null;
			if ( window.navigator && window.navigator.geolocation ) {
				here = document.createElement( 'button' );
				here.type = 'button';
				here.className = 'waymorphic-map__button waymorphic-map__button--plain';
				here.textContent = text.useLocation || 'Use my location';
				form.appendChild( here );
			}

			var reset = document.createElement( 'button' );
			reset.type = 'button';
			reset.className = 'waymorphic-map__button waymorphic-map__button--plain';
			reset.textContent = text.reset || 'Show all';
			reset.hidden = true;
			form.appendChild( reset );

			status = document.createElement( 'p' );
			status.className = 'waymorphic-map__status';
			status.setAttribute( 'role', 'status' );
			form.appendChild( status );

			// The search prefers places near the markers: on a map of shops in Wales,
			// "Newport" is the town in Wales.
			var nearMarkers = '';
			if ( items.length ) {
				var area = boundsOf(
					items.map( function ( item ) {
						return [ item.lng, item.lat ];
					} )
				);
				var camera = map.cameraForBounds( area, { padding: 0 } );
				var areaZoom = camera && isFinite( camera.zoom ) ? Math.max( 3, Math.min( 12, Math.round( camera.zoom ) ) ) : 10;
				var middle = area.getCenter().wrap();
				nearMarkers = '&lat=' + middle.lat.toFixed( 4 ) + '&lon=' + middle.lng.toFixed( 4 ) + '&zoom=' + areaZoom;
			}

			// The start of the last search: an older answer does not change the map.
			var run = 0;
			var request = null;
			form.addEventListener( 'submit', function ( event ) {
				event.preventDefault();
				var words = input.value.trim();
				if ( words.length < 2 ) {
					input.focus();
					return;
				}
				var mine = ++run;
				say( text.searching || 'Searching…' );
				if ( request ) {
					request.abort();
				}
				// A search that gets no answer in 15 seconds stops.
				var controller = window.AbortController ? new window.AbortController() : null;
				var timer = window.setTimeout( function () {
					if ( controller ) {
						controller.abort();
					}
				}, 15000 );
				request = controller;
				window
					.fetch( config.searchUrl + '?limit=1&q=' + encodeURIComponent( words ) + nearMarkers, controller ? { signal: controller.signal } : {} )
					.then( function ( response ) {
						if ( ! response.ok ) {
							throw new Error( 'HTTP ' + response.status );
						}
						return response.json();
					} )
					.then( function ( data ) {
						if ( mine !== run ) {
							return;
						}
						var feature = ( data.features || [] )[ 0 ];
						var point = feature && feature.geometry && feature.geometry.coordinates;
						if ( ! Array.isArray( point ) || typeof point[ 0 ] !== 'number' || typeof point[ 1 ] !== 'number' ) {
							say( text.notFound || 'The address was not found. Try a town or a postcode.' );
							return;
						}
						reset.hidden = false;
						var found = feature.properties || {};
						near( [ point[ 0 ], point[ 1 ] ], Number( select.value ), String( found.label || found.name || '' ) );
					} )
					.catch( function () {
						if ( mine === run ) {
							say( text.searchError || 'The search did not answer. Try again.' );
						}
					} )
					.then( function () {
						window.clearTimeout( timer );
					} );
			} );

			select.addEventListener( 'change', function () {
				if ( state.origin ) {
					near( state.origin, Number( select.value ) );
				}
			} );

			if ( here ) {
				here.addEventListener( 'click', function () {
					var mine = ++run;
					say( text.searching || 'Searching…' );
					window.navigator.geolocation.getCurrentPosition(
						function ( position ) {
							if ( mine !== run ) {
								return;
							}
							// The result is not for the text of an older search.
							input.value = '';
							reset.hidden = false;
							near( [ position.coords.longitude, position.coords.latitude ], Number( select.value ), text.here || 'your location' );
						},
						function () {
							if ( mine === run ) {
								say( text.locationError || 'The browser did not give your location.' );
							}
						},
						{ timeout: 15000 }
					);
				} );
			}

			reset.addEventListener( 'click', function ( event ) {
				run++;
				if ( request ) {
					request.abort();
				}
				state.origin = null;
				state.where = '';
				if ( originMarker ) {
					originMarker.remove();
				}
				input.value = '';
				reset.hidden = true;
				say( '' );
				// "Show all" shows the places of all the categories too.
				state.category = '';
				if ( chips ) {
					Array.prototype.forEach.call( chips.children, function ( chip, number ) {
						chip.setAttribute( 'aria-pressed', number === 0 ? 'true' : 'false' );
					} );
				}
				draw();
				if ( home ) {
					map.easeTo( home );
				}
				if ( event.detail === 0 ) {
					// The button went away while it had the keyboard focus.
					input.focus();
				}
			} );

			top.appendChild( form );
		}

		if ( config.filter ) {
			var categories = [];
			items.forEach( function ( item ) {
				if ( item.category && categories.indexOf( item.category ) === -1 ) {
					categories.push( item.category );
				}
			} );
			if ( categories.length ) {
				var group = document.createElement( 'div' );
				chips = group;
				group.className = 'waymorphic-map__filter';
				group.setAttribute( 'role', 'group' );
				group.setAttribute( 'aria-label', text.filter || 'Show a category' );
				[ '' ].concat( categories ).forEach( function ( category ) {
					var button = document.createElement( 'button' );
					button.type = 'button';
					button.className = 'waymorphic-map__chip';
					button.textContent = category || text.all || 'All';
					button.setAttribute( 'aria-pressed', category === '' ? 'true' : 'false' );
					button.addEventListener( 'click', function () {
						state.category = category;
						Array.prototype.forEach.call( group.children, function ( other ) {
							other.setAttribute( 'aria-pressed', other === button ? 'true' : 'false' );
						} );
						var shown = draw();
						if ( state.origin ) {
							// With a search, the text and the view are for the places that show now.
							report( shown );
							fitShown( shown );
						}
					} );
					group.appendChild( button );
				} );
				top.appendChild( group );
			}
		}

		if ( top.children.length ) {
			// The parts are as wide as the map.
			top.style.width = element.style.width;
			if ( top !== before ) {
				element.parentNode.insertBefore( top, element );
			}
		} else if ( top === before ) {
			before.parentNode.removeChild( before );
		}

		var fromPage = after && after.classList.contains( 'waymorphic-map__list' ) ? after : null;
		if ( config.list && items.length ) {
			list = fromPage || document.createElement( 'ul' );
			list.className = 'waymorphic-map__list';
			list.removeAttribute( 'inert' );
			// Some screen readers do not read a list that has no bullets as a list.
			list.setAttribute( 'role', 'list' );
			list.setAttribute( 'aria-label', text.list || 'Places on the map' );
			list.style.width = element.style.width;
			if ( ! fromPage ) {
				element.parentNode.insertBefore( list, element.nextSibling );
			}
		} else if ( fromPage ) {
			fromPage.parentNode.removeChild( fromPage );
		}

		draw();
	}

	/**
	 * The list of the places as text, below a map that the browser cannot show.
	 */
	function plainList( element, config, markers ) {
		var after = element.nextElementSibling;
		// PHP made the list as text: it stays.
		if ( ! markers.length || ( after && after.classList.contains( 'waymorphic-map__list' ) ) ) {
			return;
		}
		var list = document.createElement( 'ul' );
		list.className = 'waymorphic-map__list';
		list.setAttribute( 'role', 'list' );
		list.setAttribute( 'aria-label', text.list || 'Places on the map' );
		list.style.width = element.style.width;
		markers.forEach( function ( item, index ) {
			var name = markerName( item, index );
			var row = document.createElement( 'li' );
			row.className = 'waymorphic-map__list-item';
			var words = document.createElement( 'span' );
			words.className = 'waymorphic-map__list-button waymorphic-map__list-button--text';
			var label = document.createElement( 'span' );
			label.className = 'waymorphic-map__list-text';
			var title = document.createElement( 'span' );
			title.className = 'waymorphic-map__list-name';
			title.textContent = name;
			label.appendChild( title );
			if ( item.category ) {
				var detail = document.createElement( 'span' );
				detail.className = 'waymorphic-map__list-detail';
				detail.textContent = String( item.category );
				label.appendChild( document.createTextNode( ' ' ) );
				label.appendChild( detail );
			}
			words.appendChild( label );
			row.appendChild( words );
			var control = directionsControl( config, item, name );
			if ( control ) {
				row.appendChild( control );
			}
			list.appendChild( row );
		} );
		element.parentNode.insertBefore( list, element.nextSibling );
	}

	/**
	 * Makes a map in an element.
	 *
	 * @param {HTMLElement} element The container. It must have a height.
	 * @param {Object}      config  style (URL), center ([lng, lat]), zoom, fit,
	 *                              markers, shapes, controls, scrollZoom, interactive,
	 *                              locate, list, filter, locator, unit, searchUrl,
	 *                              directions, cluster, files.
	 * @return {Object|null} The MapLibre map, or null when the browser cannot show one.
	 */
	function create( element, config ) {
		var gl = window.maplibregl;
		var markers = config.markers || [];

		// The browser cannot show the map: a message, and the places as a list.
		function fail() {
			var message = document.createElement( 'p' );
			message.className = 'waymorphic-map__error';
			message.textContent = text.noMap || 'The map cannot be shown in this browser.';
			element.appendChild( message );
			element.classList.add( 'is-failed' );
			if ( config.list ) {
				plainList( element, config, markers );
			}
			return null;
		}

		if ( ! gl ) {
			return fail();
		}

		var interactive = config.interactive !== false;
		var options = {
			container: element,
			style: config.style,
			interactive: interactive,
			// Without scroll zoom, the page scrolls and ctrl or cmd + scroll zooms the map.
			cooperativeGestures: interactive && ! config.scrollZoom,
			// The plugin adds the credit: see addCredit().
			attributionControl: false,
		};
		if ( text.map && typeof text.map === 'object' ) {
			// The texts of the buttons of the map, in the language of the site.
			options.locale = text.map;
		}

		var shapes = shapeFeatures( config.shapes );
		// The points of the markers and the shapes: the view fits them.
		var points = [];
		function extend( someMarkers, someShapes ) {
			someMarkers.forEach( function ( item ) {
				points.push( [ item.lng, item.lat ] );
			} );
			someShapes.forEach( function ( feature ) {
				var type = feature.geometry.type;
				var line = feature.geometry.coordinates;
				( type === 'Polygon' ? line[ 0 ] : type === 'Point' ? [ line ] : line ).forEach( function ( point ) {
					points.push( point );
				} );
			} );
		}
		extend( markers, shapes );
		var fitOptions = {
			padding: fitPadding( element ),
			maxZoom: typeof config.zoom === 'number' ? config.zoom : 15,
		};

		if ( config.fit && points.length ) {
			options.bounds = boundsOf( points );
			options.fitBoundsOptions = fitOptions;
		} else {
			options.center = config.center || [ 0, 20 ];
			// With fit, the zoom is the upper limit of the view of the files, not the zoom of the world.
			options.zoom = typeof config.zoom === 'number' && ! config.fit ? config.zoom : 1;
		}

		var map;
		try {
			map = new gl.Map( options );
		} catch ( error ) {
			// No WebGL, for example.
			return fail();
		}
		addCredit( map, gl );

		// The page has the name of the map on the element of the map. MapLibre makes a second region
		// with the name "Map" for its canvas, which is the part that gets the keyboard focus: a
		// screen reader found two regions, one in the other. The canvas gets the name of the map.
		var name = element.getAttribute( 'aria-label' );
		if ( name && element.getAttribute( 'role' ) === 'region' ) {
			map.getCanvas().setAttribute( 'aria-label', name );
			element.removeAttribute( 'role' );
			element.removeAttribute( 'aria-label' );
			map.on( 'remove', function () {
				element.setAttribute( 'role', 'region' );
				element.setAttribute( 'aria-label', name );
			} );
		}

		// True when the map is not there now (the browser took its drawing context away).
		var gone = false;
		map.on( 'remove', function () {
			gone = true;
		} );
		// The style of the map did not come: the map server did not answer, or the address of the
		// style is wrong. The markers and the parts around the map show; the map itself is empty.
		var styled = false;
		map.once( 'styledata', function () {
			styled = true;
		} );
		map.on( 'error', function ( event ) {
			if ( window.console && window.console.error ) {
				// MapLibre writes its errors in the console only when no function listens to them.
				window.console.error( event && event.error ? event.error : event );
			}
			if ( styled || gone || element.querySelector( '.waymorphic-map__error' ) ) {
				return;
			}
			var message = document.createElement( 'p' );
			message.className = 'waymorphic-map__error waymorphic-map__error--over';
			message.textContent = text.noStyle || 'The map did not load. Try again later.';
			element.appendChild( message );
		} );

		if ( interactive && config.controls !== false ) {
			// A low map has no space for all the buttons: it has no compass.
			map.addControl( new gl.NavigationControl( { showCompass: element.clientHeight === 0 || element.clientHeight >= 240 } ), 'top-right' );
			map.addControl( new gl.FullscreenControl(), 'top-right' );
		}
		if ( interactive && config.locate ) {
			map.addControl( new gl.GeolocateControl( { positionOptions: { enableHighAccuracy: true } } ), 'top-right' );
		}
		var styleReady = false;
		var shapesWait = false;
		map.on( 'load', function () {
			styleReady = true;
			if ( shapesWait ) {
				addShapes( map, shapes );
			}
		} );

		// The markers, the shapes and the parts around the map, when the files are there.
		function finish( extra ) {
			if ( gone ) {
				return;
			}
			if ( extra ) {
				if ( config.animation === 'drop' || config.animation === 'bounce' ) {
					// The animation of the map is for the markers of the files too.
					extra.markers.forEach( function ( item ) {
						item.animation = item.animation || config.animation;
					} );
				}
				var more = shapeFeatures( extra.shapes );
				extend( extra.markers, more );
				markers = markers.concat( extra.markers );
				shapes = shapes.concat( more );
				if ( config.fit && ( extra.markers.length || more.length ) ) {
					map.fitBounds( boundsOf( points ), Object.assign( { animate: false }, fitOptions ) );
				}
			}
			if ( styleReady ) {
				addShapes( map, shapes );
			} else {
				shapesWait = true;
			}
			var all = Object.assign( {}, config, { markers: markers } );
			// With groups, the groups put the markers on the map: most markers are in a group at the start.
			var glMarkers = addMarkers( map, markers, all, !! config.cluster );
			var regroup = config.cluster ? addGroups( map, glMarkers ) : null;
			if ( config.list || config.filter || config.locator ) {
				addPanels( element, map, all, glMarkers, regroup );
			}
			element.classList.add( 'is-ready' );
			// For the scripts of a site: the map is in event.detail.map and in element.waymorphicMap.
			if ( typeof window.CustomEvent === 'function' ) {
				window.setTimeout( function () {
					if ( ! gone ) {
						element.dispatchEvent( new window.CustomEvent( 'waymorphic-map:ready', { bubbles: true, detail: { map: map } } ) );
					}
				}, 0 );
			}
		}

		if ( Array.isArray( config.files ) && config.files.length ) {
			loadFiles( config.files ).then( finish );
		} else {
			finish( null );
		}

		return map;
	}

	/**
	 * Starts one element.
	 *
	 * @param {HTMLElement} element An element with a data-waymorphic-map attribute.
	 */
	function start( element ) {
		if ( element.waymorphicMap !== undefined ) {
			return;
		}
		var config;
		try {
			// The configuration of a map with very many markers is in a script element, not in the attribute.
			var holder = element.querySelector( 'script.waymorphic-map__config' );
			config = JSON.parse( holder ? holder.textContent : element.getAttribute( 'data-waymorphic-map' ) );
		} catch ( error ) {
			return;
		}
		if ( ! config || typeof config !== 'object' ) {
			return;
		}
		try {
			element.waymorphicMap = create( element, config );
		} catch ( error ) {
			// A configuration that the map cannot use: this map does not show. The other maps of the page do.
			element.waymorphicMap = null;
			if ( window.console && window.console.error ) {
				window.console.error( 'Waymorphic Map:', error );
			}
		}
		var map = element.waymorphicMap;
		if ( ! map ) {
			// No map: the space that the page keeps for the search and the category buttons goes away.
			var space = element.previousElementSibling;
			if ( space && space.classList.contains( 'waymorphic-map__tools--wait' ) ) {
				space.parentNode.removeChild( space );
			}
			return;
		}
		// A browser has a limit for the number of maps that can draw at the same time (8 to 16).
		// On a page with more maps it takes the drawing context of the oldest map away: that map
		// was empty for the remaining time. Now the map starts again when it is near the viewport.
		map.on( 'webglcontextlost', function () {
			var timer = window.setTimeout( function () {
				if ( element.waymorphicMap !== map ) {
					return;
				}
				try {
					map.remove();
				} catch ( error ) {
					// The map is not usable. Its parts go away below.
				}
				Array.prototype.forEach.call(
					element.querySelectorAll( '.maplibregl-canvas-container, .maplibregl-control-container, .maplibregl-popup, .waymorphic-map__error' ),
					function ( part ) {
						part.parentNode.removeChild( part );
					}
				);
				element.classList.remove( 'is-ready', 'maplibregl-map' );
				element.waymorphicMap = undefined;

				// A new map takes the drawing context of a different map. When the page shows more maps
				// at one time than the browser permits, the maps would start again without end. Thus a
				// map that the visitor sees starts again only with a click, and a map that is out of
				// view starts again automatically three times in a minute at most.
				var box = element.getBoundingClientRect();
				var inView = box.bottom > 0 && box.top < window.innerHeight && box.right > 0 && box.left < window.innerWidth;
				var now = new Date().getTime();
				element.waymorphicStarts = ( element.waymorphicStarts || [] ).filter( function ( time ) {
					return now - time < 60000;
				} );
				if ( ! inView && element.waymorphicStarts.length < 3 ) {
					element.waymorphicStarts.push( now );
					watch( element );
					return;
				}
				var again = document.createElement( 'button' );
				again.type = 'button';
				again.className = 'waymorphic-map__again';
				again.textContent = text.again || 'Show the map';
				again.addEventListener( 'click', function () {
					element.removeChild( again );
					start( element );
				} );
				element.appendChild( again );
			}, 1500 );
			// The browser gave the context back (after a fault of the graphics driver): MapLibre draws the map again.
			map.once( 'webglcontextrestored', function () {
				window.clearTimeout( timer );
			} );
		} );
	}

	// Starts the maps when they come near the viewport.
	var observer = null;

	/**
	 * Starts the map of an element when the element comes near the viewport.
	 *
	 * @param {HTMLElement} element An element with a data-waymorphic-map attribute.
	 */
	function watch( element ) {
		if ( ! ( 'IntersectionObserver' in window ) ) {
			start( element );
			return;
		}
		if ( ! observer ) {
			observer = new window.IntersectionObserver(
				function ( entries ) {
					entries.forEach( function ( entry ) {
						if ( entry.isIntersecting ) {
							observer.unobserve( entry.target );
							start( entry.target );
						}
					} );
				},
				{ rootMargin: '300px' }
			);
		}
		observer.observe( element );
	}

	/**
	 * Starts each map in a document or an element, when it comes near the viewport.
	 *
	 * @param {ParentNode} [root] Where to look. The document by default.
	 */
	function init( root ) {
		Array.prototype.forEach.call( ( root || document ).querySelectorAll( '[data-waymorphic-map]' ), watch );
	}

	window.WaymorphicMap = {
		create: create,
		addMarkers: addMarkers,
		addShapes: addShapes,
		shapeFeatures: shapeFeatures,
		parseData: parseData,
		decodeText: decodeText,
		addCredit: addCredit,
		init: init,
		markerColour: MARKER_COLOUR,
	};

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', function () {
			init();
		} );
	} else {
		init();
	}
} )();
