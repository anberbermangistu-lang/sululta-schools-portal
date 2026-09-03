import { supabase } from "./supabase.js";

const form = document.getElementById("parentForm");
const messageBox = document.getElementById("messageBox");
const saveButton = document.getElementById("saveButton");

const photoInput = document.getElementById("photo");
const photoPreview = document.getElementById("photoPreview");
const previewImage = document.getElementById("previewImage");

const studentSelect = document.getElementById("studentId");
const sidebarToggle = document.getElementById("sidebarToggle");
const logoutButton = document.getElementById("logoutButton");

let selectedPhoto = null;

function showMessage(message, type = "error") {

    if (!messageBox) {
        return;
    }

    messageBox.textContent = message;

    messageBox.hidden = false;

    messageBox.classList.remove(
        "success",
        "error",
        "warning"
    );

    messageBox.classList.add(type);
}

function clearMessage() {

    if (!messageBox) {
        return;
    }

    messageBox.textContent = "";

    messageBox.hidden = true;

    messageBox.classList.remove(
        "success",
        "error",
        "warning"
    );
}


async function loadStudents() {

    if (!studentSelect) {
        return;
    }

    studentSelect.innerHTML = `
        <option value="">
            Loading students...
        </option>
    `;

    try {

        const { data, error } = await supabase
            .from("students")
            .select(`
                id,
                student_id,
                first_name,
                last_name
            `)
            .order("student_id", {
                ascending: true
            });

        if (error) {
            throw error;
        }

        studentSelect.innerHTML = `
            <option value="">
                Select Student
            </option>
        `;

        if (!data || data.length === 0) {

            studentSelect.innerHTML = `
                <option value="">
                    No students available
                </option>
            `;

            return;
        }

        data.forEach(student => {

            const option =
                document.createElement("option");

            option.value = student.id;

            const studentCode =
                student.student_id ||
                `STU${student.id}`;

            const fullName =
                `${student.first_name || ""} ${student.last_name || ""}`
                .trim();

            option.textContent =
                `${studentCode} — ${fullName}`;

            studentSelect.appendChild(option);

        });

    } catch (error) {

        console.error(
            "Error loading students:",
            error
        );

        studentSelect.innerHTML = `
            <option value="">
                Unable to load students
            </option>
        `;

        showMessage(
            "Unable to load students.",
            "error"
        );
    }
}


if (photoInput) {

    photoInput.addEventListener(
        "change",
        function () {

            const file = this.files[0];

            if (!file) {

                selectedPhoto = null;

                photoPreview.style.display =
                    "none";

                previewImage.src = "";

                return;
            }


            const allowedTypes = [
                "image/jpeg",
                "image/png",
                "image/webp"
            ];


            if (!allowedTypes.includes(file.type)) {

                showMessage(
                    "Please select a JPG, PNG or WEBP image.",
                    "error"
                );

                this.value = "";

                selectedPhoto = null;

                photoPreview.style.display =
                    "none";

                return;
            }


            if (file.size > 5 * 1024 * 1024) {

                showMessage(
                    "Photo size must not exceed 5 MB.",
                    "error"
                );

                this.value = "";

                selectedPhoto = null;

                photoPreview.style.display =
                    "none";

                return;
            }


            clearMessage();

            selectedPhoto = file;


            const reader =
                new FileReader();


            reader.onload = function (event) {

                previewImage.src =
                    event.target.result;

                photoPreview.style.display =
                    "block";

            };


            reader.readAsDataURL(file);

        }
    );
}


async function uploadPhoto(parentDatabaseId, file) {

    if (!file) {
        return null;
    }

    const extension =
        file.name
            .split(".")
            .pop()
            .toLowerCase();

    const fileName =
        `parent-${parentDatabaseId}-${Date.now()}.${extension}`;

    const filePath =
        `parents/${fileName}`;


    const {
        error: uploadError
    } = await supabase.storage
        .from("parent-photos")
        .upload(
            filePath,
            file,
            {
                cacheControl: "3600",
                upsert: true,
                contentType: file.type
            }
        );


    if (uploadError) {
        throw uploadError;
    }


    const {
        data: publicData
    } = supabase.storage
        .from("parent-photos")
        .getPublicUrl(filePath);


    return publicData?.publicUrl || null;
}


function validateForm() {

    const parentId =
        document.getElementById("parentId").value.trim();

    const firstName =
        document.getElementById("firstName").value.trim();

    const lastName =
        document.getElementById("lastName").value.trim();

    const gender =
        document.getElementById("gender").value;

    const relationship =
        document.getElementById("relationship").value;

    const studentId =
        document.getElementById("studentId").value;


    if (!parentId) {

        showMessage(
            "Parent ID is required.",
            "error"
        );

        return false;
    }


    if (!firstName) {

        showMessage(
            "First Name is required.",
            "error"
        );

        return false;
    }


    if (!lastName) {

        showMessage(
            "Last Name is required.",
            "error"
        );

        return false;
    }


    if (!gender) {

        showMessage(
            "Please select gender.",
            "error"
        );

        return false;
    }


    if (!relationship) {

        showMessage(
            "Please select relationship.",
            "error"
        );

        return false;
    }


    if (!studentId) {

        showMessage(
            "Please select a student.",
            "error"
        );

        return false;
    }


    return true;
}


async function saveParent(event) {

    event.preventDefault();

    clearMessage();


    if (!validateForm()) {
        return;
    }


    const parentId =
        document
            .getElementById("parentId")
            .value
            .trim();

    const firstName =
        document
            .getElementById("firstName")
            .value
            .trim();

    const lastName =
        document
            .getElementById("lastName")
            .value
            .trim();

    const gender =
        document.getElementById("gender").value;

    const relationship =
        document.getElementById("relationship").value;

    const status =
        document.getElementById("status").value;

    const phone =
        document
            .getElementById("phone")
            .value
            .trim();

    const email =
        document
            .getElementById("email")
            .value
            .trim();

    const occupation =
        document
            .getElementById("occupation")
            .value
            .trim();

    const studentId =
        document.getElementById("studentId").value;

    const address =
        document
            .getElementById("address")
            .value
            .trim();


    saveButton.disabled = true;

    saveButton.textContent =
        "Saving...";


    try {

        const {
            data: existingParent,
            error: checkError
        } = await supabase
            .from("parents")
            .select("id")
            .eq("parent_id", parentId)
            .maybeSingle();


        if (checkError) {
            throw checkError;
        }


        if (existingParent) {

            throw new Error(
                `Parent ID "${parentId}" already exists.`
            );
        }


        const parentData = {

            parent_id: parentId,

            first_name: firstName,

            last_name: lastName,

            gender: gender,

            relationship: relationship,

            phone: phone || null,

            email: email || null,

            occupation: occupation || null,

            student_id: Number(studentId),

            address: address || null,

            status: status

        };


        const {
            data: insertedParent,
            error: insertError
        } = await supabase
            .from("parents")
            .insert(parentData)
            .select("id")
            .single();


        if (insertError) {
            throw insertError;
        }


        if (
            selectedPhoto &&
            insertedParent
        ) {

            const photoUrl =
                await uploadPhoto(
                    insertedParent.id,
                    selectedPhoto
                );


            if (photoUrl) {

                const {
                    error: updateError
                } = await supabase
                    .from("parents")
                    .update({
                        photo_url: photoUrl
                    })
                    .eq(
                        "id",
                        insertedParent.id
                    );


                if (updateError) {
                    throw updateError;
                }
            }
        }


        showMessage(
            "Parent registered successfully.",
            "success"
        );


        form.reset();


        selectedPhoto = null;

        photoPreview.style.display =
            "none";

        previewImage.src = "";


        await loadStudents();


        setTimeout(() => {

            window.location.href =
                "/parents/dashboard.html";

        }, 1200);


    } catch (error) {

        console.error(
            "Error adding parent:",
            error
        );


        showMessage(
            error?.message ||
            "Unable to save parent.",
            "error"
        );


    } finally {

        saveButton.disabled = false;

        saveButton.textContent =
            "Save Parent";
    }
}


if (form) {

    form.addEventListener(
        "submit",
        saveParent
    );
}


if (sidebarToggle) {

    sidebarToggle.addEventListener(
        "click",
        () => {

            const sidebar =
                document.querySelector(
                    ".admin-sidebar"
                );

            if (sidebar) {
                sidebar.classList.toggle("open");
            }

        }
    );
}


if (logoutButton) {

    logoutButton.addEventListener(
        "click",
        async () => {

            try {

                await supabase.auth.signOut();

            } catch (error) {

                console.error(
                    "Logout error:",
                    error
                );
            }

            window.location.href =
                "/login.html";

        }
    );
}


loadStudents();