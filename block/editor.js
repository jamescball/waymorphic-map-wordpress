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
		// A new block: ask for the place first.
		var setup = ! hasCentre && markers.length === 0 && ! skipped;

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
					var marker = new view.maplibregl.Marker( { color: MARKER_COLOUR, draggable: true } )
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

		// Go to a search result. The first place gets a marker without a question.
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
			var found = { lat: round( point[ 1 ], 5 ), lng: round( point[ 0 ], 5 ), name: properties.name || '' };
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
					{
						variant: 'secondary',
						onClick: function () {
							addMarker( place );
						},
					},
					__( 'Add a marker', 'waymorphic-map' )
				),
				el(
					'p',
					{ style: { margin: '12px 0 0', color: '#757575' } },
					__( 'To find a place, use the search field on the map. A new marker goes to the centre of the map. To move a marker, drag it. To change its text, click it.', 'waymorphic-map' )
				)
			),
			el(
				components.PanelBody,
				{ title: __( 'Map', 'waymorphic-map' ), initialOpen: true },
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
							className: 'waymorphic-setup__skip',
							onClick: function () {
								setSkipped( true );
							},
						},
						__( 'Or move the map by hand', 'waymorphic-map' )
					)
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
				isSelected || setup ? null : el( 'div', { className: 'waymorphic-map-editor__shield' } ),
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
