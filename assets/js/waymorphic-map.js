/**
 * Waymorphic Map: turns each element with a data-waymorphic-map attribute
 * into a MapLibre map. The block editor uses WaymorphicMap.create() too.
 */
( function () {
	'use strict';

	var MARKER_COLOUR = '#1f6feb';
	var text = window.waymorphicMapL10n || {};

	/**
	 * Adds the markers of a configuration to a map.
	 *
	 * @param {Object}   map     The MapLibre map.
	 * @param {Object[]} markers Objects with lat, lng, popup (HTML) and open.
	 * @return {Object[]} The MapLibre markers.
	 */
	function addMarkers( map, markers ) {
		var gl = window.maplibregl;
		return ( markers || [] ).map( function ( item ) {
			var marker = new gl.Marker( { color: MARKER_COLOUR } ).setLngLat( [ item.lng, item.lat ] );
			if ( item.popup ) {
				// The server cleans the HTML (wp_kses_post).
				marker.setPopup( new gl.Popup( { maxWidth: '260px' } ).setHTML( item.popup ) );
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

	/**
	 * Makes a map in an element.
	 *
	 * @param {HTMLElement} element The container. It must have a height.
	 * @param {Object}      config  style (URL), center ([lng, lat]), zoom, fit,
	 *                              markers, controls, scrollZoom, interactive.
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

		if ( config.fit && markers.length > 1 ) {
			var bounds = new gl.LngLatBounds();
			markers.forEach( function ( item ) {
				bounds.extend( [ item.lng, item.lat ] );
			} );
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
		addMarkers( map, markers );
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
