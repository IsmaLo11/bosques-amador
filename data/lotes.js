/* Los 28 lotes de Bosques Amador, tomados del plano PLANO_PARA_MOSTRAR_LOTES_28_LOTES.pdf.

   Para cambiar el estado de un lote edita  "estado": "disponible" | "apartado" | "vendido".
   Para cambiar un precio edita  "precio"  (en pesos, sin comas).
   "zona": "carretera" = a orilla de carretera y con calle; "medio" = en medio del predio.
   Las coordenadas "poly" y "centro" ubican el lote sobre el plano; no las modifiques. */
window.LOTES = [
{"numero":1,"zona":"carretera","superficie":482.78,"precio":400000,"estado":"disponible","poly":[[594.3,115.5],[561.7,155.5],[630.8,185.8],[662.2,143.4]],"centro":[612.2,150.1]},
{"numero":2,"zona":"carretera","superficie":482.78,"precio":400000,"estado":"disponible","poly":[[561.3,157.1],[529.9,199.1],[598.2,227.4],[630.8,186.5]],"centro":[580.0,192.5]},
{"numero":3,"zona":"carretera","superficie":482.78,"precio":400000,"estado":"disponible","poly":[[528.9,199.5],[497.8,240.1],[566.3,270.7],[596.9,229.3]],"centro":[547.5,234.9]},
{"numero":4,"zona":"carretera","superficie":483.18,"precio":400000,"estado":"disponible","poly":[[497.3,241.5],[465.6,280.8],[534.6,311.4],[565.7,270.9]],"centro":[515.8,276.1]},
{"numero":5,"zona":"carretera","superficie":511.83,"precio":420000,"estado":"disponible","poly":[[465.6,281.9],[429,320.4],[502.5,353],[534.6,311.7]],"centro":[482.9,316.8]},
{"numero":6,"zona":"carretera","superficie":573.65,"precio":450000,"estado":"disponible","poly":[[427.9,319.6],[386.3,355.7],[472.2,394.2],[504,352.2]],"centro":[447.6,355.4]},
{"numero":7,"zona":"carretera","superficie":669.07,"precio":520000,"estado":"disponible","poly":[[386.6,356.5],[341.9,391.8],[440.8,435],[473,393.4]],"centro":[410.6,394.2]},
{"numero":8,"zona":"carretera","superficie":776.62,"precio":600000,"estado":"disponible","poly":[[341.9,391.8],[296.4,425.6],[407.8,477.4],[440.8,436.6]],"centro":[371.7,432.9]},
{"numero":9,"zona":"carretera","superficie":1085.37,"precio":830000,"estado":"apartado","poly":[[295.6,428.2],[250.8,462],[364.7,534.6],[409.4,475.7]],"centro":[330.1,475.1]},
{"numero":10,"zona":"medio","superficie":482.78,"precio":350000,"estado":"disponible","poly":[[674.4,148.9],[643.8,193.6],[714.8,221.5],[746.6,177.9]],"centro":[694.9,185.5]},
{"numero":11,"zona":"medio","superficie":482.78,"precio":350000,"estado":"disponible","poly":[[643,192.8],[611.6,233.3],[683,263.5],[714.1,222.3]],"centro":[662.9,228.0]},
{"numero":12,"zona":"medio","superficie":482.78,"precio":350000,"estado":"disponible","poly":[[611.6,232.5],[581,274.5],[652,303.1],[681.5,264.3]],"centro":[631.5,268.6]},
{"numero":13,"zona":"medio","superficie":482.78,"precio":350000,"estado":"apartado","poly":[[581,274.6],[549.2,314.6],[619.8,344.1],[651.6,304]],"centro":[600.4,309.3]},
{"numero":14,"zona":"medio","superficie":482.78,"precio":350000,"estado":"disponible","poly":[[548.8,315],[517,356.2],[588.4,385.7],[618.7,346.4]],"centro":[568.2,350.8]},
{"numero":15,"zona":"medio","superficie":482.78,"precio":350000,"estado":"disponible","poly":[[517.8,356.6],[485.6,398.2],[557.4,428.1],[588,387.6]],"centro":[537.2,392.6]},
{"numero":16,"zona":"medio","superficie":482.78,"precio":350000,"estado":"disponible","poly":[[486.7,397.2],[454.2,439.2],[525.2,467.5],[556.2,429]],"centro":[505.6,433.2]},
{"numero":17,"zona":"medio","superficie":482.78,"precio":350000,"estado":"disponible","poly":[[453.4,440],[421.6,480.4],[493.4,510.7],[524,469.1]],"centro":[473.1,475.1]},
{"numero":18,"zona":"medio","superficie":482.78,"precio":350000,"estado":"disponible","poly":[[423.2,480.4],[392.1,522.5],[460.8,551.1],[493.4,510.3]],"centro":[442.4,516.1]},
{"numero":19,"zona":"medio","superficie":701.37,"precio":490000,"estado":"disponible","poly":[[391,521.7],[376.4,539.4],[487.9,613.6],[520.5,575.1]],"centro":[443.9,562.5]},
{"numero":20,"zona":"medio","superficie":482.78,"precio":350000,"estado":"disponible","poly":[[747.8,177.3],[716.4,220.5],[771.8,245.2],[805.9,202]],"centro":[760.5,211.2]},
{"numero":21,"zona":"medio","superficie":482.78,"precio":350000,"estado":"disponible","poly":[[714.8,221.5],[682.6,262.3],[742.7,285.9],[773.7,245.8]],"centro":[728.5,253.9]},
{"numero":22,"zona":"medio","superficie":482.78,"precio":350000,"estado":"disponible","poly":[[682.6,263.2],[650.8,303.2],[711.3,328.7],[742.3,286.7]],"centro":[696.8,295.4]},
{"numero":23,"zona":"medio","superficie":482.78,"precio":350000,"estado":"disponible","poly":[[652,303.7],[620.6,345.7],[678.3,369.3],[711.3,327.7]],"centro":[665.5,336.6]},
{"numero":24,"zona":"medio","superficie":482.78,"precio":350000,"estado":"disponible","poly":[[620.6,345.3],[589.6,387.3],[646.5,410.9],[679.5,369.7]],"centro":[634.0,378.3]},
{"numero":25,"zona":"medio","superficie":482.78,"precio":350000,"estado":"disponible","poly":[[588.4,386.9],[556.6,427.4],[614.7,453.7],[648.1,409.7]],"centro":[602.0,419.4]},
{"numero":26,"zona":"medio","superficie":482.78,"precio":350000,"estado":"disponible","poly":[[556.6,427],[524.8,469],[584.1,492.5],[616.3,450.9]],"centro":[570.5,459.9]},
{"numero":27,"zona":"medio","superficie":482.78,"precio":350000,"estado":"disponible","poly":[[526,468.6],[493.4,509.1],[552.7,534.2],[583.3,493]],"centro":[538.9,501.2]},
{"numero":28,"zona":"medio","superficie":482.78,"precio":350000,"estado":"vendido","poly":[[494.2,510],[462.4,551.2],[520.5,576.4],[554.3,534.8]],"centro":[507.8,543.1]}
];

/* Contorno del área común (bosque, senderos y palapas) sobre el plano. */
window.AREA_COMUN = [[228.1,484.2],[237.2,477.2],[253.2,465.1],[265.4,472.6],[544.2,648.5],[559.2,658.2],[543.9,678.2],[527.5,699.5],[510.9,689.9],[450.8,654.1],[358.3,598.9],[348.6,590.5],[247.4,501.4]];
