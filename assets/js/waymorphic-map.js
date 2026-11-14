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

	/**
	 * The address of the directions to a marker, or an empty string.
	 */
	function directionsUrl( config, item ) {
		return config && config.directionsUrl
			? config.directionsUrl.replace( '~lat~', item.lat ).replace( '~lng~', item.lng )
			: '';
	}

	function directionsLink( config, item ) {
		var url = directionsUrl( config, item );
		if ( ! url ) {
			return null;
		}
		var link = document.createElement( 'a' );
		link.className = 'waymorphic-map__directions';
		link.href = url;
		link.target = '_blank';
		link.rel = 'noopener';
		link.textContent = text.directions || 'Directions';
		return link;
	}

	/**
	 * The name of a marker: its title, the text of its popup, or its number.
	 */
	function markerName( item, index ) {
		if ( item.title ) {
			return item.title;
		}
		if ( item.popup ) {
			var node = document.createElement( 'div' );
			node.innerHTML = item.popup;
			var words = ( node.textContent || '' ).replace( /\s+/g, ' ' ).trim();
			if ( words ) {
				return words.length > 80 ? words.slice( 0, 77 ) + '…' : words;
			}
		}
		return fill( text.marker || 'Marker %d', [ index + 1 ] );
	}

	/**
	 * Adds the markers of a configuration to a map.
	 *
	 * @param {Object}   map      The MapLibre map.
	 * @param {Object[]} markers  Objects with lat, lng, popup (HTML), open, title,
	 *                            colour, icon (URL) and animation (drop or bounce).
	 * @param {Object}   [config] The configuration of the map, for the directions link.
	 * @return {Object[]} The MapLibre markers.
	 */
	function addMarkers( map, markers, config ) {
		var gl = window.maplibregl;
		return ( markers || [] ).map( function ( item, index ) {
			var options = { color: item.colour || MARKER_COLOUR };
			if ( item.icon ) {
				var image = document.createElement( 'img' );
				image.src = item.icon;
				image.alt = '';
				options = { element: document.createElement( 'div' ), anchor: 'bottom' };
				options.element.className = 'waymorphic-map__icon';
				options.element.appendChild( image );
			}
			var marker = new gl.Marker( options ).setLngLat( [ item.lng, item.lat ] );
			var element = marker.getElement();
			element.setAttribute( 'aria-label', markerName( item, index ) );
			if ( item.animation === 'drop' || item.animation === 'bounce' ) {
				element.classList.add( 'waymorphic-map__marker--' + item.animation );
				// The markers come down one after the other.
				element.style.setProperty( '--waymorphic-delay', Math.min( index * 60, 900 ) + 'ms' );
			}

			var link = directionsLink( config, item );
			if ( item.popup || link ) {
				var content = document.createElement( 'div' );
				// The server cleans the HTML (wp_kses_post).
				content.innerHTML = item.popup || ( item.title ? '<strong>' + escapeHtml( item.title ) + '</strong>' : '' );
				if ( link ) {
					var line = document.createElement( 'p' );
					line.className = 'waymorphic-map__directions-line';
					line.appendChild( link );
					content.appendChild( line );
				}
				var popupOptions = { maxWidth: '260px' };
				if ( item.icon ) {
					// The popup goes above the picture. MapLibre does this for its own marker.
					popupOptions.offset = 44;
				}
				marker.setPopup( new gl.Popup( popupOptions ).setDOMContent( content ) );
			}
			marker.addTo( map );
			if ( item.popup && item.open ) {
				// A popup that opens with the page must not take the keyboard focus.
				var popup = marker.getPopup();
				popup.options.focusAfterOpen = false;
				marker.togglePopup();
				popup.options.focusAfterOpen = true;
			}
			return marker;
		} );
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
	 *                          ([lng, lat]), radius, colour, fill, opacity, width, popup.
	 * @return {Object[]} The features.
	 */
	function shapeFeatures( shapes ) {
		return ( shapes || [] )
			.map( function ( shape ) {
				var points = shape.points || [];
				var geometry = null;
				if ( shape.type === 'line' && points.length > 1 ) {
					geometry = { type: 'LineString', coordinates: points };
				} else if ( shape.type === 'polygon' && points.length > 2 ) {
					geometry = { type: 'Polygon', coordinates: [ points.concat( [ points[ 0 ] ] ) ] };
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
			.filter( Boolean );
	}

	/**
	 * Adds shapes to a map that has its style.
	 *
	 * @param {Object}   map      The MapLibre map.
	 * @param {Object[]} features The result of shapeFeatures().
	 */
	function addShapes( map, features ) {
		var gl = window.maplibregl;
		if ( ! features.length || map.getSource( 'waymorphic-shapes' ) ) {
			return;
		}
		map.addSource( 'waymorphic-shapes', { type: 'geojson', data: { type: 'FeatureCollection', features: features } } );
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
			layout: { 'line-join': 'round', 'line-cap': 'round' },
			paint: { 'line-color': [ 'get', 'colour' ], 'line-width': [ 'get', 'width' ] },
		} );

		[ 'waymorphic-shapes-fill', 'waymorphic-shapes-line' ].forEach( function ( layer ) {
			map.on( 'click', layer, function ( event ) {
				var feature = event.features && event.features[ 0 ];
				// One popup for a click on the fill and the outline of a shape.
				if ( ! feature || ! feature.properties.popup || event.originalEvent.waymorphicShape ) {
					return;
				}
				event.originalEvent.waymorphicShape = true;
				// The server cleans the HTML (wp_kses_post).
				new gl.Popup( { maxWidth: '260px' } ).setLngLat( event.lngLat ).setHTML( feature.properties.popup ).addTo( map );
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
	 * A distance in the unit of the map, as text.
	 */
	function distanceText( metres, unit ) {
		var value = metres / ( unit === 'mi' ? 1609.344 : 1000 );
		var shown = value < 10 ? Math.round( value * 10 ) / 10 : Math.round( value );
		return shown.toLocaleString() + ' ' + ( unit === 'mi' ? text.mi || 'mi' : text.km || 'km' );
	}

	/**
	 * The parts around the map: the search for the nearest markers and the
	 * category buttons above it, the list of the markers below it.
	 *
	 * @param {HTMLElement} element   The container of the map.
	 * @param {Object}      map       The MapLibre map.
	 * @param {Object}      config    The configuration.
	 * @param {Object[]}    glMarkers The MapLibre markers, in the sequence of config.markers.
	 */
	function addPanels( element, map, config, glMarkers ) {
		var gl = window.maplibregl;
		var items = config.markers || [];
		var unit = config.unit === 'mi' ? 'mi' : 'km';
		var state = { category: '', origin: null, radius: 0, distances: [] };
		var originMarker = null;
		var list = null;
		var status = null;

		function isVisible( index ) {
			if ( state.category && items[ index ].category !== state.category ) {
				return false;
			}
			return ! state.origin || state.distances[ index ] <= state.radius;
		}

		function show( index ) {
			var marker = glMarkers[ index ];
			var item = items[ index ];
			glMarkers.forEach( function ( other ) {
				var popup = other.getPopup();
				if ( other !== marker && popup && popup.isOpen() ) {
					other.togglePopup();
				}
			} );
			map.easeTo( { center: [ item.lng, item.lat ], zoom: Math.max( map.getZoom(), 14 ) } );
			if ( marker.getPopup() && ! marker.getPopup().isOpen() ) {
				marker.getPopup().options.focusAfterOpen = false;
				marker.togglePopup();
			}
			if ( element.scrollIntoView ) {
				element.scrollIntoView( { block: 'nearest', behavior: 'smooth' } );
			}
		}

		function draw() {
			var shown = [];
			glMarkers.forEach( function ( marker, index ) {
				var visible = isVisible( index );
				marker.getElement().style.display = visible ? '' : 'none';
				if ( ! visible && marker.getPopup() && marker.getPopup().isOpen() ) {
					marker.togglePopup();
				}
				if ( visible ) {
					shown.push( index );
				}
			} );
			if ( state.origin ) {
				shown.sort( function ( a, b ) {
					return state.distances[ a ] - state.distances[ b ];
				} );
			}
			if ( list ) {
				list.textContent = '';
				shown.forEach( function ( index ) {
					var item = items[ index ];
					var row = document.createElement( 'li' );
					row.className = 'waymorphic-map__list-item';
					var button = document.createElement( 'button' );
					button.type = 'button';
					button.className = 'waymorphic-map__list-button';
					var swatch = document.createElement( 'span' );
					swatch.className = 'waymorphic-map__list-dot';
					swatch.style.background = item.colour || MARKER_COLOUR;
					button.appendChild( swatch );
					var name = document.createElement( 'span' );
					name.className = 'waymorphic-map__list-name';
					name.textContent = markerName( item, index );
					button.appendChild( name );
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
						button.appendChild( detail );
					}
					button.addEventListener( 'click', function () {
						show( index );
					} );
					row.appendChild( button );
					var link = directionsLink( config, item );
					if ( link ) {
						row.appendChild( link );
					}
					list.appendChild( row );
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

		// Show the markers that are near a point.
		function near( origin, radius ) {
			state.origin = origin;
			state.radius = radius * ( unit === 'mi' ? 1609.344 : 1000 );
			state.distances = items.map( function ( item ) {
				return distance( origin, [ item.lng, item.lat ] );
			} );
			if ( ! originMarker ) {
				originMarker = new gl.Marker( { color: '#d63638', scale: 0.7 } );
			}
			originMarker.setLngLat( origin ).addTo( map );
			var shown = draw();
			var range = distanceText( state.radius, unit );
			var bounds = new gl.LngLatBounds( origin, origin );
			if ( shown.length ) {
				shown.forEach( function ( index ) {
					bounds.extend( [ items[ index ].lng, items[ index ].lat ] );
				} );
				say( fill( text.found || 'Places in %2$s: %1$d', [ shown.length, range ] ) );
			} else {
				circleRing( origin, state.radius ).forEach( function ( point ) {
					bounds.extend( point );
				} );
				say( fill( text.none || 'No places in %s.', [ range ] ) );
			}
			map.fitBounds( bounds, { padding: 60, maxZoom: 15 } );
		}

		var top = document.createElement( 'div' );
		top.className = 'waymorphic-map__tools';

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
					option.textContent = value + ' ' + ( unit === 'mi' ? text.mi || 'mi' : text.km || 'km' );
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

			// The start of the last search: an older answer does not change the map.
			var run = 0;
			form.addEventListener( 'submit', function ( event ) {
				event.preventDefault();
				var words = input.value.trim();
				if ( words.length < 2 ) {
					return;
				}
				var mine = ++run;
				say( text.searching || 'Searching…' );
				window
					.fetch( config.searchUrl + '?limit=1&q=' + encodeURIComponent( words ) )
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
						near( [ point[ 0 ], point[ 1 ] ], Number( select.value ) );
					} )
					.catch( function () {
						if ( mine === run ) {
							say( text.searchError || 'The search did not answer. Try again.' );
						}
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
							reset.hidden = false;
							near( [ position.coords.longitude, position.coords.latitude ], Number( select.value ) );
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

			reset.addEventListener( 'click', function () {
				run++;
				state.origin = null;
				if ( originMarker ) {
					originMarker.remove();
				}
				input.value = '';
				reset.hidden = true;
				say( '' );
				draw();
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
						draw();
					} );
					group.appendChild( button );
				} );
				top.appendChild( group );
			}
		}

		if ( top.children.length ) {
			element.parentNode.insertBefore( top, element );
		}

		if ( config.list && items.length ) {
			list = document.createElement( 'ul' );
			list.className = 'waymorphic-map__list';
			list.setAttribute( 'aria-label', text.list || 'Places on the map' );
			element.parentNode.insertBefore( list, element.nextSibling );
		}

		draw();
	}

	/**
	 * Makes a map in an element.
	 *
	 * @param {HTMLElement} element The container. It must have a height.
	 * @param {Object}      config  style (URL), center ([lng, lat]), zoom, fit,
	 *                              markers, shapes, controls, scrollZoom, interactive,
	 *                              locate, list, filter, locator, unit, searchUrl,
	 *                              directionsUrl.
	 * @return {Object|null} The MapLibre map, or null when the browser cannot show one.
	 */
	function create( element, config ) {
		var gl = window.maplibregl;
		if ( ! gl ) {
			return null;
		}

		var interactive = config.interactive !== false;
		var markers = config.markers || [];
		var options = {
			container: element,
			style: config.style,
			interactive: interactive,
			// Without scroll zoom, the page scrolls and ctrl or cmd + scroll zooms the map.
			cooperativeGestures: interactive && ! config.scrollZoom,
		};

		var shapes = shapeFeatures( config.shapes );
		var bounds = new gl.LngLatBounds();
		markers.forEach( function ( item ) {
			bounds.extend( [ item.lng, item.lat ] );
		} );
		shapes.forEach( function ( feature ) {
			var points = feature.geometry.type === 'Polygon' ? feature.geometry.coordinates[ 0 ] : feature.geometry.coordinates;
			points.forEach( function ( point ) {
				bounds.extend( point );
			} );
		} );

		if ( config.fit && ! bounds.isEmpty() ) {
			options.bounds = bounds;
			options.fitBoundsOptions = {
				padding: 60,
				maxZoom: typeof config.zoom === 'number' ? config.zoom : 15,
			};
		} else {
			options.center = config.center || [ 0, 20 ];
			options.zoom = typeof config.zoom === 'number' ? config.zoom : 1;
		}

		var map;
		try {
			map = new gl.Map( options );
		} catch ( error ) {
			// No WebGL, for example.
			var message = document.createElement( 'p' );
			message.className = 'waymorphic-map__error';
			message.textContent = text.noMap || 'The map cannot be shown in this browser.';
			element.appendChild( message );
			return null;
		}

		if ( interactive && config.controls !== false ) {
			map.addControl( new gl.NavigationControl(), 'top-right' );
			map.addControl( new gl.FullscreenControl(), 'top-right' );
		}
		if ( interactive && config.locate ) {
			map.addControl( new gl.GeolocateControl( { positionOptions: { enableHighAccuracy: true } } ), 'top-right' );
		}
		if ( shapes.length ) {
			map.on( 'load', function () {
				addShapes( map, shapes );
			} );
		}
		var glMarkers = addMarkers( map, markers, config );
		if ( config.list || config.filter || config.locator ) {
			addPanels( element, map, config, glMarkers );
		}
		element.classList.add( 'is-ready' );

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
			config = JSON.parse( element.getAttribute( 'data-waymorphic-map' ) );
		} catch ( error ) {
			return;
		}
		element.waymorphicMap = create( element, config );
	}

	/**
	 * Starts each map in a document or an element, when it comes near the viewport.
	 *
	 * @param {ParentNode} [root] Where to look. The document by default.
	 */
	function init( root ) {
		var elements = ( root || document ).querySelectorAll( '[data-waymorphic-map]' );
		if ( ! ( 'IntersectionObserver' in window ) ) {
			Array.prototype.forEach.call( elements, start );
			return;
		}
		var observer = new IntersectionObserver(
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
		Array.prototype.forEach.call( elements, function ( element ) {
			observer.observe( element );
		} );
	}

	window.WaymorphicMap = {
		create: create,
		addMarkers: addMarkers,
		addShapes: addShapes,
		shapeFeatures: shapeFeatures,
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
