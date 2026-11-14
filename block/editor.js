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

	function Edit( props ) {
		var attributes = props.attributes;
		var setAttributes = props.setAttributes;
		var isSelected = props.isSelected;

		var containerRef = useRef( null );
		var mapRef = useRef( null );
		var markersRef = useRef( [] );
		var attributesRef = useRef( attributes );
		var placeRef = useRef( '' );
		attributesRef.current = attributes;

		var readyState = useState( false );
		var ready = readyState[ 0 ];
		var setReady = readyState[ 1 ];
		var queryState = useState( '' );
		var query = queryState[ 0 ];
		var setQuery = queryState[ 1 ];
		var searchState = useState( { status: 'idle', results: [] } );
		var search = searchState[ 0 ];
		var setSearch = searchState[ 1 ];

		var lat = isNumber( attributes.lat ) ? attributes.lat : WORLD.lat;
		var lng = isNumber( attributes.lng ) ? attributes.lng : WORLD.lng;
		var hasCentre = isNumber( attributes.lat ) && isNumber( attributes.lng );
		var zoom = isNumber( attributes.zoom ) ? attributes.zoom : hasCentre ? settings.defaultZoom : WORLD.zoom;
		var markers = attributes.markers || [];

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
					placeRef.current = '';
					setAttributes( {
						lat: round( centre.lat, 5 ),
						lng: round( centre.lng, 5 ),
						zoom: round( map.getZoom(), 2 ),
					} );
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

		// The view, when it changes from the sidebar and not from the map.
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

		// The markers. In the editor they can be moved.
		var markersKey = JSON.stringify( markers );
		useEffect(
			function () {
				var map = mapRef.current;
				if ( ! map ) {
					return;
				}
				var view = containerRef.current.ownerDocument.defaultView;
				markersRef.current.forEach( function ( marker ) {
					marker.remove();
				} );
				markersRef.current = markers.map( function ( item, index ) {
					var marker = new view.maplibregl.Marker( { color: '#1f6feb', draggable: true } )
						.setLngLat( [ item.lng, item.lat ] )
						.addTo( map );
					if ( item.label ) {
						marker.setPopup( new view.maplibregl.Popup( { maxWidth: '260px' } ).setText( item.label ) );
						if ( item.open ) {
							marker.togglePopup();
						}
					}
					marker.on( 'dragend', function () {
						var position = marker.getLngLat().wrap();
						updateMarker( index, { lat: round( position.lat, 5 ), lng: round( position.lng, 5 ) } );
					} );
					return marker;
				} );
			},
			[ ready, markersKey ]
		);

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

		function addMarker() {
			var map = mapRef.current;
			var centre = map ? map.getCenter().wrap() : { lat: lat, lng: lng };
			var change = {
				markers: ( attributesRef.current.markers || [] ).concat( [
					{ lat: round( centre.lat, 5 ), lng: round( centre.lng, 5 ), label: placeRef.current, open: false },
				] ),
			};
			if ( ! hasCentre ) {
				// Keep the view the editor shows.
				change.lat = round( centre.lat, 5 );
				change.lng = round( centre.lng, 5 );
				change.zoom = round( map ? map.getZoom() : zoom, 2 );
			}
			placeRef.current = '';
			setAttributes( change );
		}

		function runSearch() {
			var words = query.trim();
			if ( words.length < 2 ) {
				return;
			}
			setSearch( { status: 'busy', results: [] } );
			var url = settings.tilesUrl + '/search?limit=5&q=' + encodeURIComponent( words );
			if ( hasCentre ) {
				url += '&lat=' + lat + '&lon=' + lng + '&zoom=' + zoom;
			}
			window
				.fetch( url )
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
					setSearch( { status: results.length ? 'done' : 'empty', results: results } );
				} )
				.catch( function () {
					setSearch( { status: 'error', results: [] } );
				} );
		}

		function goTo( feature ) {
			var point = feature.geometry.coordinates;
			var view = { center: point, zoom: 14 };
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
					view.zoom = camera.zoom;
				}
			}
			placeRef.current = ( feature.properties && feature.properties.name ) || '';
			setAttributes( {
				lat: round( view.center[ 1 ], 5 ),
				lng: round( view.center[ 0 ], 5 ),
				zoom: round( view.zoom, 2 ),
			} );
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

		var styleOptions = [
			{
				value: '',
				label: sprintf(
					/* translators: %s: the name of a map style. */
					__( 'Default (%s)', 'waymorphic-map' ),
					settings.styles[ settings.defaultStyle ] || settings.defaultStyle
				),
			},
		].concat(
			Object.keys( settings.styles ).map( function ( name ) {
				return { value: name, label: settings.styles[ name ] };
			} )
		);

		var searchMessage = {
			busy: __( 'Searching…', 'waymorphic-map' ),
			empty: __( 'Nothing found.', 'waymorphic-map' ),
			error: __( 'The search did not answer. Try again.', 'waymorphic-map' ),
		}[ search.status ];

		var inspector = el(
			wp.blockEditor.InspectorControls,
			null,
			el(
				components.PanelBody,
				{ title: __( 'Find a place', 'waymorphic-map' ), initialOpen: true },
				el(
					'form',
					{
						onSubmit: function ( event ) {
							event.preventDefault();
							runSearch();
						},
					},
					el(
						components.TextControl,
						next( {
							label: __( 'Place or address', 'waymorphic-map' ),
							value: query,
							onChange: setQuery,
						} )
					),
					el(
						components.Button,
						{
							variant: 'secondary',
							type: 'submit',
							disabled: query.trim().length < 2 || search.status === 'busy',
							style: { marginTop: '8px' },
						},
						__( 'Search', 'waymorphic-map' )
					)
				),
				searchMessage ? el( 'p', { role: 'status' }, searchMessage ) : null,
				search.results.length
					? el(
							'ul',
							{ style: { margin: '12px 0 0' } },
							search.results.map( function ( feature ) {
								var properties = feature.properties || {};
								return el(
									'li',
									{ key: feature.id },
									el(
										components.Button,
										{
											variant: 'link',
											style: { textAlign: 'left', height: 'auto', whiteSpace: 'normal' },
											onClick: function () {
												goTo( feature );
											},
										},
										properties.label || properties.name || feature.id
									)
								);
							} )
					  )
					: null
			),
			el(
				components.PanelBody,
				{ title: __( 'Markers', 'waymorphic-map' ), initialOpen: true },
				markers.map( function ( item, index ) {
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
				el(
					components.Button,
					{ variant: 'secondary', onClick: addMarker },
					__( 'Add a marker', 'waymorphic-map' )
				),
				el(
					'p',
					{ style: { margin: '12px 0 0', color: '#757575' } },
					__( 'A new marker goes to the centre of the map. To move a marker, drag it on the map.', 'waymorphic-map' )
				)
			),
			el(
				components.PanelBody,
				{ title: __( 'Map', 'waymorphic-map' ), initialOpen: false },
				el(
					components.SelectControl,
					next( {
						label: __( 'Style', 'waymorphic-map' ),
						value: attributes.mapStyle || '',
						options: styleOptions,
						onChange: function ( value ) {
							setAttributes( { mapStyle: value } );
						},
					} )
				),
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
				),
				el( 'div', { style: { height: '16px' } } ),
				numberField( __( 'Latitude', 'waymorphic-map' ), 'lat', -85, 85, 'any' ),
				el( 'div', { style: { height: '16px' } } ),
				numberField( __( 'Longitude', 'waymorphic-map' ), 'lng', -180, 180, 'any' ),
				el( 'div', { style: { height: '16px' } } ),
				numberField( __( 'Zoom', 'waymorphic-map' ), 'zoom', 0, 22, 'any' )
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
			)
		);

		var height = /^\d+(\.\d+)?$/.test( ( attributes.height || '' ).trim() )
			? attributes.height.trim() + 'px'
			: attributes.height || settings.defaultHeight;

		return el(
			wp.element.Fragment,
			null,
			inspector,
			el(
				'div',
				wp.blockEditor.useBlockProps( { className: 'waymorphic-map-editor' } ),
				el( 'div', { ref: containerRef, className: 'waymorphic-map', style: { height: height } } ),
				// The first click selects the block; after that the map moves.
				isSelected ? null : el( 'div', { className: 'waymorphic-map-editor__shield' } )
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
