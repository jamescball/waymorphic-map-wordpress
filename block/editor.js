/**
 * The editor side of the Waymorphic Map block. Plain JavaScript on the wp.*
 * globals, so the plugin has no build step.
 */
( function ( wp ) {
	'use strict';

	var el = wp.element.createElement;
	var useEffect = wp.element.useEffect;
	var useRef = wp.element.useRef;
	var useState = wp.element.useState;
	var __ = wp.i18n.__;
	var sprintf = wp.i18n.sprintf;
	var components = wp.components;
	var settings = window.waymorphicMapEditor || {};

	var WORLD = { lat: 20, lng: 0, zoom: 1 };
	var MARKER_COLOUR = '#1f6feb';
	var MARKER_COLOURS = [
		{ name: __( 'Blue', 'waymorphic-map' ), color: '#1f6feb' },
		{ name: __( 'Red', 'waymorphic-map' ), color: '#d63638' },
		{ name: __( 'Green', 'waymorphic-map' ), color: '#008a20' },
		{ name: __( 'Orange', 'waymorphic-map' ), color: '#e26f00' },
		{ name: __( 'Purple', 'waymorphic-map' ), color: '#7a3ff2' },
		{ name: __( 'Black', 'waymorphic-map' ), color: '#1d2327' },
	];

	var SHAPE_NAMES = {
		polygon: __( 'Polygon', 'waymorphic-map' ),
		line: __( 'Line', 'waymorphic-map' ),
		circle: __( 'Circle', 'waymorphic-map' ),
		rectangle: __( 'Rectangle', 'waymorphic-map' ),
	};
	// The sidebar shows the fields of this number of markers and shapes.
	var SIDEBAR_LIMIT = 30;

	// A shape of the block ([lat, lng] points) as the page script wants it ([lng, lat]).
	function frontShape( shape ) {
		var points = ( shape.points || [] ).map( function ( point ) {
			return [ point[ 1 ], point[ 0 ] ];
		} );
		var item = { type: shape.type, points: points, colour: shape.colour, fill: shape.fill, radius: shape.radius };
		if ( shape.type === 'rectangle' ) {
			if ( points.length < 2 ) {
				return null;
			}
			item.type = 'polygon';
			item.points = [ points[ 0 ], [ points[ 1 ][ 0 ], points[ 0 ][ 1 ] ], points[ 1 ], [ points[ 0 ][ 0 ], points[ 1 ][ 1 ] ] ];
		}
		return item;
	}

	// 500 points of a long line at most: the page shows no more.
	function thin( points ) {
		if ( points.length <= 500 ) {
			return points;
		}
		var step = ( points.length - 1 ) / 499;
		var result = [];
		for ( var i = 0; i < 500; i++ ) {
			result.push( points[ Math.round( i * step ) ] );
		}
		return result;
	}

	function round( value, places ) {
		var factor = Math.pow( 10, places );
		return Math.round( value * factor ) / factor;
	}

	function isNumber( value ) {
		return typeof value === 'number' && isFinite( value );
	}

	// The new look of the controls, without the deprecation messages.
	function next( props ) {
		props.__nextHasNoMarginBottom = true;
		props.__next40pxDefaultSize = true;
		return props;
	}

	function styleUrl( name ) {
		return settings.tilesUrl + '/styles/' + ( name || settings.defaultStyle );
	}

	// The editor must not use the keys that are typed in a field on the map.
	function keepKeys( event ) {
		event.stopPropagation();
	}

	/**
	 * A search field with suggestions while the user types.
	 *
	 * props: onPick( feature ), getFocus() (the view of the map, or null),
	 * placeholder, autoFocus.
	 */
	function PlaceSearch( props ) {
		var textState = useState( '' );
		var text = textState[ 0 ];
		var setText = textState[ 1 ];
		var resultState = useState( { status: 'idle', results: [] } );
		var result = resultState[ 0 ];
		var setResult = resultState[ 1 ];
		var activeState = useState( 0 );
		var active = activeState[ 0 ];
		var setActive = activeState[ 1 ];
		var openState = useState( false );
		var open = openState[ 0 ];
		var setOpen = openState[ 1 ];
		var idRef = useRef( 'waymorphic-search-' + Math.random().toString( 36 ).slice( 2 ) );
		// The text of the place that was selected: no new search for it.
		var pickedRef = useRef( '' );

		useEffect(
			function () {
				var words = text.trim();
				if ( words.length < 2 || words === pickedRef.current ) {
					setResult( { status: 'idle', results: [] } );
					return;
				}
				var controller = 'AbortController' in window ? new window.AbortController() : null;
				var timer = window.setTimeout( function () {
					var url = settings.tilesUrl + '/search?limit=6&q=' + encodeURIComponent( words );
					var focus = props.getFocus ? props.getFocus() : null;
					if ( focus ) {
						url += '&lat=' + focus.lat + '&lon=' + focus.lng + '&zoom=' + focus.zoom;
					}
					setResult( function ( before ) {
						return { status: 'busy', results: before.results };
					} );
					window
						.fetch( url, controller ? { signal: controller.signal } : {} )
						.then( function ( response ) {
							if ( ! response.ok ) {
								throw new Error( 'HTTP ' + response.status );
							}
							return response.json();
						} )
						.then( function ( data ) {
							var results = ( data.features || [] ).filter( function ( feature ) {
								return feature.geometry && Array.isArray( feature.geometry.coordinates );
							} );
							setActive( 0 );
							setResult( { status: results.length ? 'done' : 'empty', results: results } );
						} )
						.catch( function ( error ) {
							if ( error && error.name === 'AbortError' ) {
								return;
							}
							setResult( { status: 'error', results: [] } );
						} );
				}, 250 );

				return function () {
					window.clearTimeout( timer );
					if ( controller ) {
						controller.abort();
					}
				};
			},
			[ text ]
		);

		function pick( feature ) {
			var properties = feature.properties || {};
			pickedRef.current = properties.name || properties.label || '';
			setText( pickedRef.current );
			setOpen( false );
			setResult( { status: 'idle', results: [] } );
			props.onPick( feature );
		}

		// The keys are handled on the field itself, before the editor gets them:
		// the editor uses the arrow keys to go from block to block.
		var inputRef = useRef( null );
		var keyRef = useRef( null );
		keyRef.current = onKeyDown;
		useEffect( function () {
			var input = inputRef.current;
			function down( event ) {
				keyRef.current( event );
			}
			input.addEventListener( 'keydown', down );
			input.addEventListener( 'keyup', keepKeys );
			input.addEventListener( 'keypress', keepKeys );
			return function () {
				input.removeEventListener( 'keydown', down );
				input.removeEventListener( 'keyup', keepKeys );
				input.removeEventListener( 'keypress', keepKeys );
			};
		}, [] );

		function onKeyDown( event ) {
			event.stopPropagation();
			var count = result.results.length;
			if ( event.key === 'ArrowDown' && count ) {
				event.preventDefault();
				setOpen( true );
				setActive( ( active + 1 ) % count );
			} else if ( event.key === 'ArrowUp' && count ) {
				event.preventDefault();
				setActive( ( active - 1 + count ) % count );
			} else if ( event.key === 'Enter' ) {
				event.preventDefault();
				if ( count ) {
					pick( result.results[ Math.min( active, count - 1 ) ] );
				}
			} else if ( event.key === 'Escape' ) {
				setOpen( false );
			}
		}

		var message = {
			empty: __( 'Nothing found. Try a town, a street or a postcode.', 'waymorphic-map' ),
			error: __( 'The search did not answer. Try again.', 'waymorphic-map' ),
		}[ result.status ];
		var showList = open && ( result.results.length > 0 || !! message );
		var listId = idRef.current + '-list';

		return el(
			'div',
			{ className: 'waymorphic-search' + ( result.status === 'busy' ? ' is-busy' : '' ) },
			el( 'input', {
				type: 'search',
				className: 'waymorphic-search__input',
				role: 'combobox',
				'aria-label': __( 'Search for a place or an address', 'waymorphic-map' ),
				'aria-expanded': showList,
				'aria-controls': listId,
				'aria-autocomplete': 'list',
				'aria-activedescendant': showList && result.results.length ? idRef.current + '-' + active : undefined,
				autoComplete: 'off',
				placeholder: props.placeholder || __( 'Search for a place or an address', 'waymorphic-map' ),
				value: text,
				autoFocus: !! props.autoFocus,
				onChange: function ( event ) {
					pickedRef.current = '';
					setText( event.target.value );
					setOpen( true );
				},
				onFocus: function () {
					setOpen( true );
				},
				onBlur: function () {
					setOpen( false );
				},
				ref: inputRef,
			} ),
			showList
				? el(
						'ul',
						{ className: 'waymorphic-search__list', role: 'listbox', id: listId },
						result.results.map( function ( feature, index ) {
							var properties = feature.properties || {};
							var name = properties.name || properties.label || feature.id;
							var detail = properties.label && properties.label !== name ? properties.label : '';
							return el(
								'li',
								{
									key: feature.id || index,
									id: idRef.current + '-' + index,
									role: 'option',
									'aria-selected': index === active,
									className: 'waymorphic-search__item' + ( index === active ? ' is-active' : '' ),
									// mousedown, not click: the field must keep the focus.
									onMouseDown: function ( event ) {
										event.preventDefault();
										pick( feature );
									},
									onMouseEnter: function () {
										setActive( index );
									},
								},
								el( 'strong', null, name ),
								detail ? el( 'span', null, detail ) : null
							);
						} ),
						message ? el( 'li', { className: 'waymorphic-search__message', role: 'status' }, message ) : null
				  )
				: null
		);
	}

	// The swatch colours of each style, the same as in the Waymorphic map browser.
	var STYLE_COLOURS = {
		positron: { land: '#f2f3f0', water: '#c2c8ca', road: '#ffffff' },
		bright: { land: '#f8f4f0', water: '#a0c8f0', road: '#ffe89a' },
		liberty: { land: '#efefef', water: '#9ebdff', road: '#ffd88a' },
		dark: { land: '#0e0e0e', water: '#1b1b1b', road: '#3a3a3a' },
		fiord: { land: '#2b3a49', water: '#1a2937', road: '#4e6070' },
	};

	/**
	 * The styles as swatches: land, a bay of water and a road, drawn with CSS,
	 * as in the Waymorphic map browser. A radio group: the arrow keys move
	 * between the styles.
	 *
	 * props: value (the style in use), onChange( name ).
	 */
	function StylePicker( props ) {
		var names = Object.keys( settings.styles );

		function onKeyDown( event ) {
			var step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[ event.key ];
			if ( ! step ) {
				return;
			}
			event.preventDefault();
			var name = names[ ( names.indexOf( props.value ) + step + names.length ) % names.length ];
			props.onChange( name );
			var button = event.currentTarget.querySelector( '[data-style="' + name + '"]' );
			if ( button ) {
				button.focus();
			}
		}

		return el(
			'div',
			{
				className: 'waymorphic-styles',
				role: 'radiogroup',
				'aria-label': __( 'Map style', 'waymorphic-map' ),
				onKeyDown: onKeyDown,
			},
			names.map( function ( name ) {
				var selected = name === props.value;
				var colours = STYLE_COLOURS[ name ] || { land: '#ddd', water: '#bbb', road: '#fff' };
				return el(
					'button',
					{
						key: name,
						type: 'button',
						role: 'radio',
						className: 'waymorphic-styles__item',
						'data-style': name,
						'aria-checked': selected,
						tabIndex: selected ? 0 : -1,
						title: settings.styles[ name ],
						onClick: function () {
							props.onChange( name );
						},
					},
					el( 'span', {
						className: 'waymorphic-styles__swatch',
						'aria-hidden': 'true',
						style: { '--land': colours.land, '--water': colours.water, '--road': colours.road },
					} ),
					name.charAt( 0 ).toUpperCase() + name.slice( 1 )
				);
			} )
		);
	}

	function Edit( props ) {
		var attributes = props.attributes;
		var setAttributes = props.setAttributes;
		var isSelected = props.isSelected;

		var containerRef = useRef( null );
		var mapRef = useRef( null );
		var markersRef = useRef( [] );
		var attributesRef = useRef( attributes );
		// The marker whose text field opens after the next draw of the markers.
		var editRef = useRef( -1 );
		attributesRef.current = attributes;
		// The popup that offers a marker at the point of a click.
		var offerRef = useRef( null );
		var addRef = useRef( null );
		// The shape that the user draws: its type and its points, or null.
		var drawState = useState( null );
		var drawing = drawState[ 0 ];
		var setDrawing = drawState[ 1 ];
		var drawRef = useRef( null );
		drawRef.current = drawing;
		var drawPointRef = useRef( null );
		var drawMarkersRef = useRef( [] );
		var shapesDrawRef = useRef( null );
		var shapesDirtyRef = useRef( false );
		var noteState = useState( '' );
		var note = noteState[ 0 ];
		var setNote = noteState[ 1 ];
		var locateState = useState( 'idle' );
		var locating = locateState[ 0 ];
		var setLocating = locateState[ 1 ];

		var readyState = useState( false );
		var ready = readyState[ 0 ];
		var setReady = readyState[ 1 ];
		// The place of the last search, while the map is still on it.
		var placeState = useState( null );
		var place = placeState[ 0 ];
		var setPlace = placeState[ 1 ];
		var skipState = useState( false );
		var skipped = skipState[ 0 ];
		var setSkipped = skipState[ 1 ];

		var lat = isNumber( attributes.lat ) ? attributes.lat : WORLD.lat;
		var lng = isNumber( attributes.lng ) ? attributes.lng : WORLD.lng;
		var hasCentre = isNumber( attributes.lat ) && isNumber( attributes.lng );
		var zoom = isNumber( attributes.zoom ) ? attributes.zoom : hasCentre ? settings.defaultZoom : WORLD.zoom;
		var markers = attributes.markers || [];
		var shapes = attributes.shapes || [];
		// A new block: ask for the place first.
		var setup = ! hasCentre && markers.length === 0 && shapes.length === 0 && ! skipped;

		// Make the map. MapLibre comes from the window the block is in: the
		// editor canvas is an iframe, and the map must use that window.
		useEffect( function () {
			var node = containerRef.current;
			var view = node.ownerDocument.defaultView;
			var timer = null;
			var map = null;
			var stopped = false;

			function make() {
				if ( stopped ) {
					return;
				}
				if ( ! view.maplibregl ) {
					timer = view.setTimeout( make, 100 );
					return;
				}
				try {
					map = new view.maplibregl.Map( {
						container: node,
						style: styleUrl( attributesRef.current.mapStyle ),
						center: [ lng, lat ],
						zoom: zoom,
						cooperativeGestures: true,
					} );
				} catch ( error ) {
					return;
				}
				map.addControl( new view.maplibregl.NavigationControl(), 'top-right' );
				// Only a move by the user changes the block. A resize fires moveend too.
				map.on( 'moveend', function ( event ) {
					if ( ! event.originalEvent ) {
						return;
					}
					var centre = map.getCenter().wrap();
					setPlace( null );
					setAttributes( {
						lat: round( centre.lat, 5 ),
						lng: round( centre.lng, 5 ),
						zoom: round( map.getZoom(), 2 ),
					} );
				} );
				// A click on the map offers a marker at that point.
				map.on( 'click', function ( event ) {
					var target = event.originalEvent && event.originalEvent.target;
					if ( target && target.closest && target.closest( '.maplibregl-marker, .maplibregl-popup' ) ) {
						return;
					}
					if ( drawRef.current ) {
						// The click is a point of the shape.
						drawPointRef.current( event.lngLat.wrap() );
						return;
					}
					if ( offerRef.current ) {
						offerRef.current.remove();
						offerRef.current = null;
					} else if ( node.querySelector( '.maplibregl-popup' ) ) {
						// This click closes the form of a marker.
						return;
					}
					var point = event.lngLat.wrap();
					var button = node.ownerDocument.createElement( 'button' );
					button.type = 'button';
					button.className = 'waymorphic-map-editor__here';
					button.textContent = __( 'Add a marker here', 'waymorphic-map' );
					var popup = new view.maplibregl.Popup( { closeOnClick: false, focusAfterOpen: false, offset: 4 } )
						.setLngLat( point )
						.setDOMContent( button )
						.addTo( map );
					popup.on( 'close', function () {
						if ( offerRef.current === popup ) {
							offerRef.current = null;
						}
					} );
					offerRef.current = popup;
					button.addEventListener( 'click', function () {
						popup.remove();
						addRef.current( { lat: point.lat, lng: point.lng, name: '' } );
					} );
				} );
				// A new style removes the shapes: draw them again.
				map.on( 'idle', function () {
					if ( shapesDrawRef.current && ( shapesDirtyRef.current || ! map.getSource( 'waymorphic-shapes' ) ) ) {
						shapesDrawRef.current();
					}
				} );
				mapRef.current = map;
				setReady( true );
			}

			make();

			return function () {
				stopped = true;
				view.clearTimeout( timer );
				if ( map ) {
					map.remove();
				}
				mapRef.current = null;
			};
		}, [] );

		// The style.
		var firstStyle = useRef( true );
		useEffect(
			function () {
				if ( ! mapRef.current ) {
					return;
				}
				if ( firstStyle.current ) {
					firstStyle.current = false;
					return;
				}
				mapRef.current.setStyle( styleUrl( attributes.mapStyle ) );
			},
			[ ready, attributes.mapStyle ]
		);

		// The view, when it changes from the search or the sidebar and not from the map.
		useEffect(
			function () {
				var map = mapRef.current;
				if ( ! map ) {
					return;
				}
				var centre = map.getCenter().wrap();
				if (
					Math.abs( centre.lat - lat ) > 0.00001 ||
					Math.abs( centre.lng - lng ) > 0.00001 ||
					Math.abs( map.getZoom() - zoom ) > 0.01
				) {
					map.jumpTo( { center: [ lng, lat ], zoom: zoom } );
				}
			},
			[ ready, lat, lng, zoom ]
		);

		// The form in the popup of a marker in the editor: its text and a remove button.
		function markerForm( doc, item, index ) {
			var removed = false;
			var form = doc.createElement( 'div' );
			form.className = 'waymorphic-marker-form';

			var label = doc.createElement( 'label' );
			label.textContent = __( 'Popup text', 'waymorphic-map' );
			var input = doc.createElement( 'input' );
			input.type = 'text';
			input.value = item.label || '';
			input.placeholder = __( 'For example: Our office', 'waymorphic-map' );
			label.appendChild( input );
			form.appendChild( label );

			var remove = doc.createElement( 'button' );
			remove.type = 'button';
			remove.className = 'waymorphic-marker-form__remove';
			remove.textContent = __( 'Remove the marker', 'waymorphic-map' );
			form.appendChild( remove );

			[ 'keydown', 'keyup', 'keypress' ].forEach( function ( type ) {
				form.addEventListener( type, keepKeys );
			} );
			input.addEventListener( 'keydown', function ( event ) {
				if ( event.key === 'Enter' ) {
					input.blur();
				}
			} );
			// The text is saved when the field loses the focus, because a
			// change draws the markers again and that closes the popup.
			input.addEventListener( 'change', function () {
				if ( ! removed ) {
					updateMarker( index, { label: input.value } );
				}
			} );
			function onRemove( event ) {
				event.preventDefault();
				if ( ! removed ) {
					removed = true;
					removeMarker( index );
				}
			}
			// mousedown comes before the change event of the field.
			remove.addEventListener( 'mousedown', onRemove );
			remove.addEventListener( 'click', onRemove );

			return { form: form, input: input };
		}

		// The markers. In the editor they can be moved, and a click opens the form.
		var markersKey = JSON.stringify( markers );
		useEffect(
			function () {
				var map = mapRef.current;
				if ( ! map ) {
					return;
				}
				var node = containerRef.current;
				var view = node.ownerDocument.defaultView;
				markersRef.current.forEach( function ( marker ) {
					marker.remove();
				} );
				markersRef.current = markers.map( function ( item, index ) {
					var parts = markerForm( node.ownerDocument, item, index );
					var markerOptions = { color: item.colour || MARKER_COLOUR, draggable: true };
					if ( item.icon ) {
						var image = node.ownerDocument.createElement( 'img' );
						image.src = item.icon;
						image.alt = '';
						markerOptions = { element: node.ownerDocument.createElement( 'div' ), anchor: 'bottom', draggable: true };
						markerOptions.element.className = 'waymorphic-map__icon';
						markerOptions.element.appendChild( image );
					}
					var marker = new view.maplibregl.Marker( markerOptions )
						.setLngLat( [ item.lng, item.lat ] )
						.setPopup( new view.maplibregl.Popup( { maxWidth: '280px', focusAfterOpen: false } ).setDOMContent( parts.form ) )
						.addTo( map );
					marker.getElement().title = __( 'Drag to move. Click to change the text.', 'waymorphic-map' );
					marker.on( 'dragend', function () {
						var position = marker.getLngLat().wrap();
						updateMarker( index, { lat: round( position.lat, 5 ), lng: round( position.lng, 5 ) } );
					} );
					if ( editRef.current === index ) {
						editRef.current = -1;
						marker.togglePopup();
						parts.input.focus( { preventScroll: true } );
						parts.input.select();
					}
					return marker;
				} );
			},
			[ ready, markersKey ]
		);

		// The shapes, and the points of the shape that the user draws.
		var shapesKey = JSON.stringify( [ shapes, drawing ] );
		useEffect(
			function () {
				var map = mapRef.current;
				if ( ! map ) {
					return;
				}
				var view = containerRef.current.ownerDocument.defaultView;
				var script = view.WaymorphicMap;
				if ( ! script || ! script.shapeFeatures ) {
					return;
				}
				shapesDrawRef.current = function () {
					var list = shapes.map( frontShape ).filter( Boolean );
					if ( drawing && drawing.points.length > 1 ) {
						list.push( { type: 'line', points: frontShape( drawing ).points, colour: '#d63638', width: 2 } );
					}
					var data = { type: 'FeatureCollection', features: script.shapeFeatures( list ) };
					try {
						var source = map.getSource( 'waymorphic-shapes' );
						if ( source ) {
							source.setData( data );
						} else if ( data.features.length ) {
							script.addShapes( map, data.features );
						}
						shapesDirtyRef.current = false;
					} catch ( error ) {
						// The style is not ready: the map draws the shapes when it is.
						shapesDirtyRef.current = true;
					}
				};
				shapesDrawRef.current();

				drawMarkersRef.current.forEach( function ( marker ) {
					marker.remove();
				} );
				drawMarkersRef.current = ( drawing ? drawing.points : [] ).map( function ( point ) {
					return new view.maplibregl.Marker( { color: '#d63638', scale: 0.5 } ).setLngLat( [ point[ 1 ], point[ 0 ] ] ).addTo( map );
				} );
			},
			[ ready, shapesKey ]
		);

		// Keep the view that the editor shows, when the block has no view.
		function withView( change ) {
			var map = mapRef.current;
			if ( map && ( ! isNumber( attributesRef.current.lat ) || ! isNumber( attributesRef.current.lng ) ) ) {
				var centre = map.getCenter().wrap();
				change.lat = round( centre.lat, 5 );
				change.lng = round( centre.lng, 5 );
				change.zoom = round( map.getZoom(), 2 );
			}
			return change;
		}

		function addShape( shape ) {
			setDrawing( null );
			setAttributes(
				withView( {
					shapes: ( attributesRef.current.shapes || [] ).concat( [ Object.assign( { colour: MARKER_COLOUR, label: '' }, shape ) ] ),
				} )
			);
		}

		function updateShape( index, change ) {
			setAttributes( {
				shapes: ( attributesRef.current.shapes || [] ).map( function ( item, i ) {
					return i === index ? Object.assign( {}, item, change ) : item;
				} ),
			} );
		}

		function removeShape( index ) {
			setAttributes( {
				shapes: ( attributesRef.current.shapes || [] ).filter( function ( item, i ) {
					return i !== index;
				} ),
			} );
		}

		// A click on the map while the user draws a shape.
		drawPointRef.current = function ( point ) {
			var now = drawRef.current;
			var points = now.points.concat( [ [ round( point.lat, 5 ), round( point.lng, 5 ) ] ] );
			var map = mapRef.current;
			if ( now.type === 'circle' ) {
				// The first radius: an eighth of the width of the view, in metres.
				var bounds = map.getBounds();
				var width = ( bounds.getEast() - bounds.getWest() ) * 111320 * Math.cos( ( point.lat * Math.PI ) / 180 );
				var radius = Math.max( 10, width / 8 );
				var unit = Math.pow( 10, Math.floor( Math.log( radius ) / Math.LN10 ) );
				addShape( { type: 'circle', points: points, radius: Math.round( radius / unit ) * unit } );
			} else if ( now.type === 'rectangle' && points.length === 2 ) {
				addShape( { type: 'rectangle', points: points } );
			} else {
				setDrawing( { type: now.type, points: points } );
			}
		};

		function startDrawing( type ) {
			if ( offerRef.current ) {
				offerRef.current.remove();
				offerRef.current = null;
			}
			setSkipped( true );
			setDrawing( { type: type, points: [] } );
		}

		// Add the markers and the shapes of a CSV, GeoJSON, KML or GPX file.
		function importFile( file ) {
			var view = containerRef.current.ownerDocument.defaultView;
			var script = ( view.WaymorphicMap && view.WaymorphicMap.parseData ? view.WaymorphicMap : window.WaymorphicMap ) || {};
			if ( ! file || ! script.parseData || ! window.FileReader ) {
				return;
			}
			var reader = new window.FileReader();
			reader.onload = function () {
				var data = script.parseData( String( reader.result || '' ), file.name );
				var before = attributesRef.current.markers || [];
				var newMarkers = data.markers.slice( 0, Math.max( 0, 1000 - before.length ) ).map( function ( item ) {
					return {
						lat: round( item.lat, 5 ),
						lng: round( item.lng, 5 ),
						label: item.title && item.text ? item.title + ': ' + item.text : item.title || item.text || '',
						open: false,
						category: item.category,
						colour: item.colour,
						icon: item.icon,
					};
				} );
				var newShapes = data.shapes.slice( 0, 100 ).map( function ( item ) {
					return {
						type: item.type,
						points: thin( item.points ).map( function ( point ) {
							return [ round( point[ 1 ], 5 ), round( point[ 0 ], 5 ) ];
						} ),
						colour: item.colour || MARKER_COLOUR,
						fill: item.fill,
						label: item.text || '',
					};
				} );
				if ( ! newMarkers.length && ! newShapes.length ) {
					setNote( __( 'The file has no markers or shapes that the plugin can read.', 'waymorphic-map' ) );
					return;
				}
				var change = {
					markers: before.concat( newMarkers ),
					shapes: ( attributesRef.current.shapes || [] ).concat( newShapes ),
				};
				// Show all that came from the file.
				var map = mapRef.current;
				if ( map ) {
					var bounds = new view.maplibregl.LngLatBounds();
					newMarkers.forEach( function ( item ) {
						bounds.extend( [ item.lng, item.lat ] );
					} );
					newShapes.forEach( function ( item ) {
						item.points.forEach( function ( point ) {
							bounds.extend( [ point[ 1 ], point[ 0 ] ] );
						} );
					} );
					var camera = map.cameraForBounds( bounds, { padding: 60, maxZoom: 15 } );
					if ( camera && isNumber( camera.zoom ) ) {
						var centre = view.maplibregl.LngLat.convert( camera.center ).wrap();
						change.lat = round( centre.lat, 5 );
						change.lng = round( centre.lng, 5 );
						change.zoom = round( camera.zoom, 2 );
					}
				}
				setSkipped( true );
				setPlace( null );
				setAttributes( change );
				setNote(
					sprintf(
						/* translators: 1: a number of markers, 2: a number of shapes. */
						__( 'Markers added: %1$d. Shapes added: %2$d.', 'waymorphic-map' ),
						newMarkers.length,
						newShapes.length
					)
				);
			};
			reader.readAsText( file );
		}

		function updateMarker( index, change ) {
			var list = ( attributesRef.current.markers || [] ).map( function ( item, i ) {
				return i === index ? Object.assign( {}, item, change ) : item;
			} );
			setAttributes( { markers: list } );
		}

		function removeMarker( index ) {
			setAttributes( {
				markers: ( attributesRef.current.markers || [] ).filter( function ( item, i ) {
					return i !== index;
				} ),
			} );
		}

		// A marker at a place from the search, or at the centre of the map.
		function addMarker( at ) {
			var map = mapRef.current;
			var centre = map ? map.getCenter().wrap() : { lat: lat, lng: lng };
			var point = at && isNumber( at.lat ) ? at : { lat: centre.lat, lng: centre.lng, name: '' };
			var list = attributesRef.current.markers || [];
			var change = {
				markers: list.concat( [
					{ lat: round( point.lat, 5 ), lng: round( point.lng, 5 ), label: point.name || '', open: false },
				] ),
			};
			if ( ! isNumber( attributesRef.current.lat ) || ! isNumber( attributesRef.current.lng ) ) {
				// Keep the view the editor shows.
				change.lat = round( centre.lat, 5 );
				change.lng = round( centre.lng, 5 );
				change.zoom = round( map ? map.getZoom() : zoom, 2 );
			}
			editRef.current = list.length;
			setPlace( null );
			setAttributes( change );
		}

		addRef.current = addMarker;

		// Show a place. The first place gets a marker without a question.
		function showPlace( found, newZoom ) {
			var change = { lat: found.lat, lng: found.lng, zoom: round( newZoom, 2 ) };
			var list = attributesRef.current.markers || [];
			if ( list.length === 0 ) {
				change.markers = [ { lat: found.lat, lng: found.lng, label: found.name, open: false } ];
				setPlace( null );
			} else {
				setPlace( found );
			}
			setAttributes( change );
		}

		// Go to a search result.
		function goTo( feature ) {
			var point = feature.geometry.coordinates;
			var properties = feature.properties || {};
			var newZoom = 15;
			var map = mapRef.current;
			if ( map && Array.isArray( feature.bbox ) && feature.bbox.length === 4 ) {
				var camera = map.cameraForBounds(
					[
						[ feature.bbox[ 0 ], feature.bbox[ 1 ] ],
						[ feature.bbox[ 2 ], feature.bbox[ 3 ] ],
					],
					{ padding: 20, maxZoom: 16 }
				);
				if ( camera && isNumber( camera.zoom ) ) {
					newZoom = camera.zoom;
				}
			}
			showPlace( { lat: round( point[ 1 ], 5 ), lng: round( point[ 0 ], 5 ), name: properties.name || '' }, newZoom );
		}

		// Go to the position that the browser gives.
		function locate() {
			var geolocation = window.navigator && window.navigator.geolocation;
			if ( ! geolocation ) {
				setLocating( 'error' );
				return;
			}
			setLocating( 'busy' );
			geolocation.getCurrentPosition(
				function ( position ) {
					setLocating( 'idle' );
					showPlace(
						{ lat: round( position.coords.latitude, 5 ), lng: round( position.coords.longitude, 5 ), name: '' },
						15
					);
				},
				function () {
					setLocating( 'error' );
				},
				{ enableHighAccuracy: true, timeout: 15000 }
			);
		}

		function getFocus() {
			return isNumber( attributesRef.current.lat ) && isNumber( attributesRef.current.lng )
				? { lat: attributesRef.current.lat, lng: attributesRef.current.lng, zoom: zoom }
				: null;
		}

		function numberField( label, key, min, max, step ) {
			return el(
				components.TextControl,
				next( {
					label: label,
					type: 'number',
					min: min,
					max: max,
					step: step,
					value: isNumber( attributes[ key ] ) ? String( attributes[ key ] ) : '',
					onChange: function ( value ) {
						var number = parseFloat( value );
						var change = {};
						change[ key ] = isFinite( number ) ? Math.max( min, Math.min( max, number ) ) : undefined;
						setAttributes( change );
					},
				} )
			);
		}

		var toolbar = el(
			wp.blockEditor.BlockControls,
			null,
			el(
				components.ToolbarGroup,
				null,
				el(
					components.ToolbarButton,
					{
						icon: 'location',
						onClick: function () {
							addMarker( place );
						},
					},
					__( 'Add marker', 'waymorphic-map' )
				)
			)
		);

		var inspector = el(
			wp.blockEditor.InspectorControls,
			null,
			el(
				components.PanelBody,
				{ title: __( 'Markers', 'waymorphic-map' ), initialOpen: true },
				markers.slice( 0, SIDEBAR_LIMIT ).map( function ( item, index ) {
					return el(
						'div',
						{ key: index, style: { marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid #ddd' } },
						el(
							components.TextControl,
							next( {
								label: sprintf(
									/* translators: %d: the number of the marker. */
									__( 'Marker %d: popup text', 'waymorphic-map' ),
									index + 1
								),
								value: item.label || '',
								onChange: function ( value ) {
									updateMarker( index, { label: value } );
								},
							} )
						),
						el( 'div', { style: { height: '8px' } } ),
						el(
							components.ToggleControl,
							next( {
								label: __( 'Show the popup when the page opens', 'waymorphic-map' ),
								checked: !! item.open,
								disabled: ! item.label,
								onChange: function ( value ) {
									updateMarker( index, { open: value } );
								},
							} )
						),
						el(
							components.TextControl,
							next( {
								label: __( 'Category', 'waymorphic-map' ),
								help: index === 0 ? __( 'For the category buttons and the list. For example: Shops.', 'waymorphic-map' ) : undefined,
								value: item.category || '',
								onChange: function ( value ) {
									updateMarker( index, { category: value } );
								},
							} )
						),
						el( 'div', { style: { height: '8px' } } ),
						el( components.ColorPalette, {
							'aria-label': __( 'Colour of the marker', 'waymorphic-map' ),
							colors: MARKER_COLOURS,
							value: item.colour || MARKER_COLOUR,
							clearable: false,
							onChange: function ( value ) {
								// The page shows hex colours only.
								updateMarker( index, { colour: /^#[0-9a-f]{6}$/i.test( value || '' ) ? value : undefined } );
							},
						} ),
						el(
							wp.blockEditor.MediaUploadCheck,
							null,
							el( wp.blockEditor.MediaUpload, {
								allowedTypes: [ 'image' ],
								onSelect: function ( media ) {
									if ( media && media.url ) {
										updateMarker( index, { icon: media.url } );
									}
								},
								render: function ( media ) {
									return el(
										components.Button,
										{ variant: 'link', onClick: media.open, style: { display: 'block', marginBottom: '8px' } },
										item.icon
											? __( 'Change the picture of the marker', 'waymorphic-map' )
											: __( 'Use a picture as the marker', 'waymorphic-map' )
									);
								},
							} )
						),
						item.icon
							? el(
									components.Button,
									{
										variant: 'link',
										style: { display: 'block', marginBottom: '8px' },
										onClick: function () {
											updateMarker( index, { icon: undefined } );
										},
									},
									__( 'Use the usual marker', 'waymorphic-map' )
							  )
							: null,
						el(
							components.Button,
							{
								variant: 'link',
								isDestructive: true,
								onClick: function () {
									removeMarker( index );
								},
							},
							__( 'Remove the marker', 'waymorphic-map' )
						)
					);
				} ),
				markers.length > SIDEBAR_LIMIT
					? el(
							'p',
							{ style: { color: '#757575' } },
							sprintf(
								/* translators: 1: a number of markers, 2: the number of all the markers. */
								__( 'The sidebar shows %1$d of the %2$d markers. To change one of the others, click it on the map.', 'waymorphic-map' ),
								SIDEBAR_LIMIT,
								markers.length
							)
					  )
					: null,
				el(
					components.Button,
					{
						variant: 'secondary',
						onClick: function () {
							addMarker( place );
						},
					},
					__( 'Add a marker', 'waymorphic-map' )
				),
				el( 'div', { style: { height: '8px' } } ),
				el(
					components.FormFileUpload,
					{
						accept: '.csv,.geojson,.json,.kml,.gpx',
						variant: 'secondary',
						onChange: function ( event ) {
							var input = event.currentTarget;
							importFile( input.files && input.files[ 0 ] );
							// The same file can be selected again.
							input.value = '';
						},
					},
					__( 'Import a file', 'waymorphic-map' )
				),
				el(
					'p',
					{ style: { margin: '8px 0 0', color: '#757575' } },
					__( 'CSV, GeoJSON, KML or GPX. A CSV file has a first row with the column names: lat, lng, title, description, category, colour.', 'waymorphic-map' )
				),
				note ? el( 'p', { role: 'status', style: { margin: '8px 0 0' } }, note ) : null,
				markers.length > 1
					? el(
							components.Button,
							{
								variant: 'link',
								isDestructive: true,
								style: { marginTop: '8px' },
								onClick: function () {
									setNote( '' );
									setAttributes( { markers: [] } );
								},
							},
							__( 'Remove all the markers', 'waymorphic-map' )
					  )
					: null,
				el(
					'p',
					{ style: { margin: '12px 0 0', color: '#757575' } },
					__( 'To find a place, use the search field on the map. To add a marker, click the map at the point. To move a marker, drag it. To change its text, click it.', 'waymorphic-map' )
				)
			),
			el(
				components.PanelBody,
				{ title: __( 'Shapes', 'waymorphic-map' ), initialOpen: false },
				shapes.slice( 0, SIDEBAR_LIMIT ).map( function ( item, index ) {
					return el(
						'div',
						{ key: index, style: { marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid #ddd' } },
						el(
							components.TextControl,
							next( {
								label: sprintf(
									/* translators: 1: the type of a shape, 2: its number. */
									__( '%1$s %2$d: popup text', 'waymorphic-map' ),
									SHAPE_NAMES[ item.type ] || item.type,
									index + 1
								),
								value: item.label || '',
								onChange: function ( value ) {
									updateShape( index, { label: value } );
								},
							} )
						),
						el( 'div', { style: { height: '8px' } } ),
						item.type === 'circle'
							? el(
									components.TextControl,
									next( {
										label: __( 'Radius in metres', 'waymorphic-map' ),
										type: 'number',
										min: 1,
										value: String( item.radius || 1000 ),
										onChange: function ( value ) {
											var number = parseFloat( value );
											if ( isFinite( number ) && number > 0 ) {
												updateShape( index, { radius: number } );
											}
										},
									} )
							  )
							: null,
						item.type === 'circle' ? el( 'div', { style: { height: '8px' } } ) : null,
						el( components.ColorPalette, {
							'aria-label': __( 'Colour of the shape', 'waymorphic-map' ),
							colors: MARKER_COLOURS,
							value: item.colour || MARKER_COLOUR,
							clearable: false,
							onChange: function ( value ) {
								if ( /^#[0-9a-f]{6}$/i.test( value || '' ) ) {
									updateShape( index, { colour: value, fill: undefined } );
								}
							},
						} ),
						el(
							components.Button,
							{
								variant: 'link',
								isDestructive: true,
								onClick: function () {
									removeShape( index );
								},
							},
							__( 'Remove the shape', 'waymorphic-map' )
						)
					);
				} ),
				shapes.length > SIDEBAR_LIMIT
					? el(
							'p',
							{ style: { color: '#757575' } },
							sprintf(
								/* translators: 1: a number of shapes, 2: the number of all the shapes. */
								__( 'The sidebar shows %1$d of the %2$d shapes.', 'waymorphic-map' ),
								SIDEBAR_LIMIT,
								shapes.length
							)
					  )
					: null,
				el(
					'div',
					{ style: { display: 'flex', flexWrap: 'wrap', gap: '8px' } },
					[ 'polygon', 'line', 'circle', 'rectangle' ].map( function ( type ) {
						return el(
							components.Button,
							{
								key: type,
								variant: 'secondary',
								isPressed: !! drawing && drawing.type === type,
								onClick: function () {
									startDrawing( type );
								},
							},
							SHAPE_NAMES[ type ]
						);
					} )
				),
				el(
					'p',
					{ style: { margin: '12px 0 0', color: '#757575' } },
					__( 'Select a type, then click the map. A polygon and a line: click each point, then select "Finish". A circle: click the centre. A rectangle: click two opposite corners.', 'waymorphic-map' )
				),
				shapes.length > 1
					? el(
							components.Button,
							{
								variant: 'link',
								isDestructive: true,
								style: { marginTop: '8px' },
								onClick: function () {
									setAttributes( { shapes: [] } );
								},
							},
							__( 'Remove all the shapes', 'waymorphic-map' )
					  )
					: null
			),
			el(
				components.PanelBody,
				{ title: __( 'Map', 'waymorphic-map' ), initialOpen: true },
				el( StylePicker, {
					value: attributes.mapStyle || settings.defaultStyle,
					onChange: function ( value ) {
						setAttributes( { mapStyle: value } );
					},
				} ),
				el( 'div', { style: { height: '16px' } } ),
				el(
					components.TextControl,
					next( {
						label: __( 'Height', 'waymorphic-map' ),
						help: __( 'For example 400px or 60vh.', 'waymorphic-map' ),
						placeholder: settings.defaultHeight,
						value: attributes.height || '',
						onChange: function ( value ) {
							setAttributes( { height: value } );
						},
					} )
				)
			),
			el(
				components.PanelBody,
				{ title: __( 'Features', 'waymorphic-map' ), initialOpen: false },
				el(
					components.ToggleControl,
					next( {
						label: __( 'List of the markers below the map', 'waymorphic-map' ),
						help: __( 'A click on a name shows that marker.', 'waymorphic-map' ),
						checked: !! attributes.list,
						onChange: function ( value ) {
							setAttributes( { list: value } );
						},
					} )
				),
				el(
					components.ToggleControl,
					next( {
						label: __( 'Search for the nearest markers', 'waymorphic-map' ),
						help: __( 'Visitors type an address and see the markers in a distance. Their browser sends the address to the map server.', 'waymorphic-map' ),
						checked: !! attributes.locator,
						onChange: function ( value ) {
							setAttributes( { locator: value } );
						},
					} )
				),
				attributes.locator || attributes.list
					? el(
							components.SelectControl,
							next( {
								label: __( 'Unit of distance', 'waymorphic-map' ),
								value: attributes.unit === 'mi' ? 'mi' : 'km',
								options: [
									{ label: __( 'Kilometres', 'waymorphic-map' ), value: 'km' },
									{ label: __( 'Miles', 'waymorphic-map' ), value: 'mi' },
								],
								onChange: function ( value ) {
									setAttributes( { unit: value } );
								},
							} )
					  )
					: null,
				attributes.locator || attributes.list ? el( 'div', { style: { height: '16px' } } ) : null,
				el(
					components.ToggleControl,
					next( {
						label: __( 'Groups of markers', 'waymorphic-map' ),
						help: __( 'Markers that are near to each other show as one circle with their number.', 'waymorphic-map' ),
						checked: !! attributes.cluster,
						onChange: function ( value ) {
							setAttributes( { cluster: value } );
						},
					} )
				),
				el(
					components.ToggleControl,
					next( {
						label: __( 'Category buttons', 'waymorphic-map' ),
						help: __( 'Visitors select a category and see only its markers.', 'waymorphic-map' ),
						checked: !! attributes.filter,
						onChange: function ( value ) {
							setAttributes( { filter: value } );
						},
					} )
				),
				el(
					components.ToggleControl,
					next( {
						label: __( 'Directions link', 'waymorphic-map' ),
						help: __( 'Each popup gets a link to the directions on openstreetmap.org.', 'waymorphic-map' ),
						checked: !! attributes.directions,
						onChange: function ( value ) {
							setAttributes( { directions: value } );
						},
					} )
				),
				el(
					components.ToggleControl,
					next( {
						label: __( 'Button for the location of the visitor', 'waymorphic-map' ),
						checked: !! attributes.locate,
						disabled: ! attributes.interactive,
						onChange: function ( value ) {
							setAttributes( { locate: value } );
						},
					} )
				),
				el(
					components.SelectControl,
					next( {
						label: __( 'Marker animation', 'waymorphic-map' ),
						value: attributes.animation || '',
						options: [
							{ label: __( 'None', 'waymorphic-map' ), value: '' },
							{ label: __( 'Drop', 'waymorphic-map' ), value: 'drop' },
							{ label: __( 'Bounce', 'waymorphic-map' ), value: 'bounce' },
						],
						onChange: function ( value ) {
							setAttributes( { animation: value } );
						},
					} )
				),
				el(
					'p',
					{ style: { margin: '12px 0 0', color: '#757575' } },
					__( 'These features show on the page, not in the editor.', 'waymorphic-map' )
				)
			),
			el(
				components.PanelBody,
				{ title: __( 'Behaviour', 'waymorphic-map' ), initialOpen: false },
				el(
					components.ToggleControl,
					next( {
						label: __( 'Visitors can move the map', 'waymorphic-map' ),
						checked: attributes.interactive,
						onChange: function ( value ) {
							setAttributes( { interactive: value } );
						},
					} )
				),
				el(
					components.ToggleControl,
					next( {
						label: __( 'Show the zoom and fullscreen buttons', 'waymorphic-map' ),
						checked: attributes.controls,
						disabled: ! attributes.interactive,
						onChange: function ( value ) {
							setAttributes( { controls: value } );
						},
					} )
				),
				el(
					components.ToggleControl,
					next( {
						label: __( 'Scroll to zoom', 'waymorphic-map' ),
						help: __( 'When this is off, the page scrolls, and ctrl or cmd + scroll zooms the map.', 'waymorphic-map' ),
						checked: attributes.scrollZoom,
						disabled: ! attributes.interactive,
						onChange: function ( value ) {
							setAttributes( { scrollZoom: value } );
						},
					} )
				),
				el(
					components.TextControl,
					next( {
						label: __( 'Name for screen readers', 'waymorphic-map' ),
						placeholder: __( 'Map', 'waymorphic-map' ),
						value: attributes.title || '',
						onChange: function ( value ) {
							setAttributes( { title: value } );
						},
					} )
				)
			),
			el(
				components.PanelBody,
				{ title: __( 'Exact position', 'waymorphic-map' ), initialOpen: false },
				numberField( __( 'Latitude', 'waymorphic-map' ), 'lat', -85, 85, 'any' ),
				el( 'div', { style: { height: '16px' } } ),
				numberField( __( 'Longitude', 'waymorphic-map' ), 'lng', -180, 180, 'any' ),
				el( 'div', { style: { height: '16px' } } ),
				numberField( __( 'Zoom', 'waymorphic-map' ), 'zoom', 0, 22, 'any' )
			)
		);

		var height = /^\d+(\.\d+)?$/.test( ( attributes.height || '' ).trim() )
			? attributes.height.trim() + 'px'
			: attributes.height || settings.defaultHeight;

		var overlay = null;
		if ( setup ) {
			// A new block: one question, then the map is ready.
			overlay = el(
				'div',
				{ className: 'waymorphic-setup' },
				el(
					'div',
					{ className: 'waymorphic-setup__card' },
					el( 'p', { className: 'waymorphic-setup__title' }, __( 'Where is your map?', 'waymorphic-map' ) ),
					el(
						'p',
						{ className: 'waymorphic-setup__text' },
						__( 'Type an address, a town or a postcode, then select it from the list. The map goes there and gets a marker.', 'waymorphic-map' )
					),
					el( PlaceSearch, { onPick: goTo, getFocus: getFocus } ),
					el(
						'button',
						{
							type: 'button',
							className: 'waymorphic-setup__locate',
							disabled: locating === 'busy',
							onClick: locate,
						},
						locating === 'busy'
							? __( 'Finding your location…', 'waymorphic-map' )
							: __( 'Use my location', 'waymorphic-map' )
					),
					locating === 'error'
						? el(
								'p',
								{ className: 'waymorphic-setup__error', role: 'alert' },
								__( 'The browser did not give your location. Use the search field.', 'waymorphic-map' )
						  )
						: null,
					el(
						'button',
						{
							type: 'button',
							className: 'waymorphic-setup__skip',
							onClick: function () {
								setSkipped( true );
							},
						},
						__( 'Or move the map by hand', 'waymorphic-map' )
					)
				)
			);
		} else if ( drawing ) {
			var enough = drawing.points.length >= ( drawing.type === 'polygon' ? 3 : 2 );
			overlay = el(
				'div',
				{ className: 'waymorphic-map-editor__draw', role: 'status' },
				el(
					'span',
					null,
					{
						polygon: __( 'Click each corner of the polygon.', 'waymorphic-map' ),
						line: __( 'Click each point of the line.', 'waymorphic-map' ),
						circle: __( 'Click the centre of the circle.', 'waymorphic-map' ),
						rectangle: __( 'Click two opposite corners of the rectangle.', 'waymorphic-map' ),
					}[ drawing.type ]
				),
				drawing.type === 'polygon' || drawing.type === 'line'
					? el(
							'button',
							{
								type: 'button',
								className: 'waymorphic-map-editor__add',
								disabled: ! enough,
								onClick: function () {
									addShape( { type: drawing.type, points: drawing.points } );
								},
							},
							__( 'Finish', 'waymorphic-map' )
					  )
					: null,
				el(
					'button',
					{
						type: 'button',
						className: 'waymorphic-map-editor__cancel',
						onClick: function () {
							setDrawing( null );
						},
					},
					__( 'Cancel', 'waymorphic-map' )
				)
			);
		} else if ( isSelected ) {
			overlay = el(
				'div',
				{ className: 'waymorphic-map-editor__search' },
				el( PlaceSearch, { onPick: goTo, getFocus: getFocus } ),
				place
					? el(
							'button',
							{
								type: 'button',
								className: 'waymorphic-map-editor__add',
								onClick: function () {
									addMarker( place );
								},
							},
							place.name
								? sprintf(
										/* translators: %s: the name of a place. */
										__( 'Add a marker at %s', 'waymorphic-map' ),
										place.name
								  )
								: __( 'Add a marker here', 'waymorphic-map' )
					  )
					: null
			);
		}

		return el(
			wp.element.Fragment,
			null,
			toolbar,
			inspector,
			el(
				'div',
				wp.blockEditor.useBlockProps( { className: 'waymorphic-map-editor' } ),
				el( 'div', { ref: containerRef, className: 'waymorphic-map', style: { height: height } } ),
				// The first click selects the block; after that the map moves.
				isSelected || setup || drawing ? null : el( 'div', { className: 'waymorphic-map-editor__shield' } ),
				overlay
			)
		);
	}

	wp.blocks.registerBlockType( 'waymorphic/map', {
		edit: Edit,
		save: function () {
			// PHP shows the block (render_callback).
			return null;
		},
	} );
} )( window.wp );
