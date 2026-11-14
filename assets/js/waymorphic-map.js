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
		if ( ! features.length || map.getSource( 'waymorphic-shapes' ) ) {
			return;
		}
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
	 * Shows or hides a marker: a filter or the search hides it
	 * (waymorphicHidden), and a group hides it (waymorphicGrouped).
	 */
	function showOrHide( marker ) {
		var visible = ! marker.waymorphicHidden && ! marker.waymorphicGrouped;
		marker.getElement().style.display = visible ? '' : 'none';
		if ( ! visible && marker.getPopup() && marker.getPopup().isOpen() ) {
			marker.togglePopup();
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
			circles.forEach( function ( circle ) {
				circle.remove();
			} );
			circles = [];
			var groups = [];
			// From zoom 17, each marker shows: markers at one point stay apart from the others.
			var apart = map.getZoom() >= 17;
			glMarkers.forEach( function ( marker ) {
				marker.waymorphicGrouped = false;
				if ( marker.waymorphicHidden || apart ) {
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
					map.fitBounds( bounds, { padding: 80, maxZoom: 17 } );
				} );
				circles.push(
					new gl.Marker( { element: button } )
						.setLngLat( [ lng / group.markers.length, lat / group.markers.length ] )
						.addTo( map )
				);
			} );
			glMarkers.forEach( showOrHide );
		}

		map.on( 'zoomend', update );
		map.on( 'resize', update );
		update();
		return update;
	}

	var HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

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
		if ( words.indexOf( '<' ) !== -1 ) {
			words = ( new window.DOMParser().parseFromString( words, 'text/html' ).body.textContent || '' );
		}
		words = words.replace( /\s+/g, ' ' ).trim();
		return words.length > 1000 ? words.slice( 0, 999 ) + '…' : words;
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
			} else if ( c === '"' ) {
				quoted = true;
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
			lng = parseFloat( lng );
			lat = parseFloat( lat );
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

		function shape( type, points, values ) {
			points = ( points || [] )
				.map( function ( point ) {
					return [ parseFloat( point[ 0 ] ), parseFloat( point[ 1 ] ) ];
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
			if ( points.length < ( type === 'polygon' ? 3 : 2 ) ) {
				return;
			}
			var item = { type: type, points: points };
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
					marker( point[ 0 ], point[ 1 ], values );
				} );
			} else if ( part.type === 'LineString' ) {
				shape( 'line', c, values );
			} else if ( part.type === 'MultiLineString' ) {
				c.forEach( function ( line ) {
					shape( 'line', line, values );
				} );
			} else if ( part.type === 'Polygon' ) {
				shape( 'polygon', c[ 0 ], values );
			} else if ( part.type === 'MultiPolygon' ) {
				c.forEach( function ( polygon ) {
					shape( 'polygon', polygon[ 0 ], values );
				} );
			}
		}

		function feature( item ) {
			if ( ! item || typeof item !== 'object' ) {
				return;
			}
			if ( item.type === 'FeatureCollection' ) {
				( item.features || [] ).forEach( feature );
			} else if ( item.type === 'Feature' ) {
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
					var ring = all( node, 'outerBoundaryIs' )[ 0 ] || node;
					shape( 'polygon', kml( all( ring, 'coordinates' )[ 0 ] || ring ), values );
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
			return cell.trim().toLowerCase();
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
	 * Gets the files of a map and reads them.
	 *
	 * @param {Object[]} files Objects with url, and the optional colour and category
	 *                         for the markers and shapes that have none.
	 * @return {Promise<{markers: Object[], shapes: Object[]}>} With the popup HTML made.
	 */
	function loadFiles( files ) {
		return Promise.all(
			files.map( function ( file ) {
				return window
					.fetch( file.url )
					.then( function ( response ) {
						if ( ! response.ok ) {
							throw new Error( 'HTTP ' + response.status );
						}
						return response.text();
					} )
					.then( function ( content ) {
						var data = parseData( content, file.url );
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
	 * @param {Function}    [regroup] The result of addGroups(), when the map has groups.
	 */
	function addPanels( element, map, config, glMarkers, regroup ) {
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
			// On a map with groups, zoom 17 shows each marker.
			map.easeTo( { center: [ item.lng, item.lat ], zoom: Math.max( map.getZoom(), regroup ? 17 : 14 ) } );
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
				marker.waymorphicHidden = ! visible;
				if ( visible ) {
					shown.push( index );
				}
			} );
			if ( regroup ) {
				regroup();
			} else {
				glMarkers.forEach( showOrHide );
			}
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
	 *                              directionsUrl, cluster, files.
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
		function extend( someMarkers, someShapes ) {
			someMarkers.forEach( function ( item ) {
				bounds.extend( [ item.lng, item.lat ] );
			} );
			someShapes.forEach( function ( feature ) {
				var type = feature.geometry.type;
				var points = feature.geometry.coordinates;
				( type === 'Polygon' ? points[ 0 ] : type === 'Point' ? [ points ] : points ).forEach( function ( point ) {
					bounds.extend( point );
				} );
			} );
		}
		extend( markers, shapes );
		var fitOptions = {
			padding: 60,
			maxZoom: typeof config.zoom === 'number' ? config.zoom : 15,
		};

		if ( config.fit && ! bounds.isEmpty() ) {
			options.bounds = bounds;
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
			if ( extra ) {
				var more = shapeFeatures( extra.shapes );
				extend( extra.markers, more );
				markers = markers.concat( extra.markers );
				shapes = shapes.concat( more );
				if ( config.fit && ! bounds.isEmpty() && ( extra.markers.length || more.length ) ) {
					map.fitBounds( bounds, Object.assign( { animate: false }, fitOptions ) );
				}
			}
			if ( styleReady ) {
				addShapes( map, shapes );
			} else {
				shapesWait = true;
			}
			var all = Object.assign( {}, config, { markers: markers } );
			var glMarkers = addMarkers( map, markers, all );
			var regroup = config.cluster ? addGroups( map, glMarkers ) : null;
			if ( config.list || config.filter || config.locator ) {
				addPanels( element, map, all, glMarkers, regroup );
			}
			element.classList.add( 'is-ready' );
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
		parseData: parseData,
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
